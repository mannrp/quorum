package migrate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"

	"github.com/jackc/pgx/v5"
)

var migrationName = regexp.MustCompile(`^(\d{6})_[a-z0-9][a-z0-9_]*\.sql$`)

type Migration struct {
	Version  string
	Name     string
	SQL      string
	Checksum string
}

func Discover(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read migration directory: %w", err)
	}

	migrations := make([]Migration, 0, len(entries))
	versions := make(map[string]string)
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		match := migrationName.FindStringSubmatch(entry.Name())
		if match == nil {
			return nil, fmt.Errorf("invalid migration filename %q", entry.Name())
		}
		version := match[1]
		if previous, exists := versions[version]; exists {
			return nil, fmt.Errorf("duplicate migration version %s in %q and %q", version, previous, entry.Name())
		}
		body, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read migration %q: %w", entry.Name(), err)
		}
		sum := sha256.Sum256(body)
		versions[version] = entry.Name()
		migrations = append(migrations, Migration{
			Version:  version,
			Name:     entry.Name(),
			SQL:      string(body),
			Checksum: hex.EncodeToString(sum[:]),
		})
	}
	if len(migrations) == 0 {
		return nil, fmt.Errorf("no SQL migrations found in %q", dir)
	}
	sort.Slice(migrations, func(i, j int) bool { return migrations[i].Version < migrations[j].Version })
	return migrations, nil
}

const advisoryLockID int64 = 7628173022401

func Apply(ctx context.Context, conn *pgx.Conn, migrations []Migration) error {
	if len(migrations) == 0 {
		return fmt.Errorf("refusing to run an empty migration set")
	}
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", advisoryLockID); err != nil {
		return fmt.Errorf("acquire migration advisory lock: %w", err)
	}
	defer func() { _, _ = conn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", advisoryLockID) }()

	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			checksum TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
		ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT
	`); err != nil {
		return fmt.Errorf("ensure migration ledger: %w", err)
	}

	for _, migration := range migrations {
		var checksum *string
		err := conn.QueryRow(ctx, "SELECT checksum FROM schema_migrations WHERE version = $1", migration.Name).Scan(&checksum)
		if err == nil {
			appliedChecksum := ""
			if checksum != nil {
				appliedChecksum = *checksum
			}
			if err := verifyAppliedChecksum(migration, appliedChecksum); err != nil {
				return err
			}
			continue
		}
		if err != pgx.ErrNoRows {
			return fmt.Errorf("read migration ledger for %s: %w", migration.Name, err)
		}

		tx, err := conn.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", migration.Name, err)
		}
		if _, err = tx.Exec(ctx, "SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'"); err == nil {
			_, err = tx.Exec(ctx, migration.SQL)
		}
		if err == nil {
			_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", migration.Name, migration.Checksum)
		}
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", migration.Name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", migration.Name, err)
		}
	}
	return nil
}

func verifyAppliedChecksum(migration Migration, applied string) error {
	if applied == "" {
		return fmt.Errorf("applied migration %s has no checksum; explicit ledger repair is required", migration.Name)
	}
	if applied != migration.Checksum {
		return fmt.Errorf("applied migration %s checksum mismatch", migration.Name)
	}
	return nil
}
