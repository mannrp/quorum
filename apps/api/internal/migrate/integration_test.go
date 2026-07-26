package migrate

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func TestIntegrationEmptyReplayChecksumAndExtensions(t *testing.T) {
	conn := newIntegrationDatabase(t)
	migrations := canonicalMigrations(t)

	if err := Apply(context.Background(), conn, migrations); err != nil {
		t.Fatalf("empty migration replay failed: %v", err)
	}
	var count int
	if err := conn.QueryRow(context.Background(), "SELECT count(*) FROM schema_migrations").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != len(migrations) {
		t.Fatalf("migration ledger has %d rows, want %d", count, len(migrations))
	}
	for _, extension := range []string{"pgcrypto", "pg_trgm"} {
		var installed bool
		if err := conn.QueryRow(context.Background(), "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = $1)", extension).Scan(&installed); err != nil {
			t.Fatal(err)
		}
		if !installed {
			t.Fatalf("required extension %s is not installed", extension)
		}
	}

	mutated := append([]Migration(nil), migrations...)
	mutated[0].Checksum = "intentionally-mutated"
	if err := Apply(context.Background(), conn, mutated); err == nil {
		t.Fatal("expected applied migration mutation to fail")
	}
}

func TestIntegrationConcurrentMigratorsSerialize(t *testing.T) {
	conn := newIntegrationDatabase(t)
	second, err := pgx.ConnectConfig(context.Background(), conn.Config().Copy())
	if err != nil {
		t.Fatal("connect second migrator")
	}
	defer second.Close(context.Background())
	migrations := canonicalMigrations(t)

	var wg sync.WaitGroup
	errors := make(chan error, 2)
	for _, candidate := range []*pgx.Conn{conn, second} {
		wg.Add(1)
		go func(connection *pgx.Conn) {
			defer wg.Done()
			errors <- Apply(context.Background(), connection, migrations)
		}(candidate)
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatalf("concurrent migration failed: %v", err)
		}
	}
}

func TestIntegrationNMinusOneUpgrade(t *testing.T) {
	conn := newIntegrationDatabase(t)
	migrations := canonicalMigrations(t)
	if len(migrations) < 2 {
		t.Fatal("N-1 test requires at least two migrations")
	}
	if err := Apply(context.Background(), conn, migrations[:len(migrations)-1]); err != nil {
		t.Fatalf("N-1 replay failed: %v", err)
	}
	if err := Apply(context.Background(), conn, migrations); err != nil {
		t.Fatalf("N-1 upgrade failed: %v", err)
	}
}

func TestIntegrationLegacyLedgerFailsClosedWithoutChecksum(t *testing.T) {
	conn := newIntegrationDatabase(t)
	migrations := canonicalMigrations(t)
	_, err := conn.Exec(context.Background(), `
		CREATE TABLE schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err == nil {
		_, err = conn.Exec(context.Background(), "INSERT INTO schema_migrations (version) VALUES ($1)", migrations[0].Name)
	}
	if err != nil {
		t.Fatal(err)
	}
	if err := Apply(context.Background(), conn, migrations); err == nil {
		t.Fatal("expected legacy ledger without checksums to require explicit repair")
	}
}

func TestIntegrationAdvisoryLockHonorsCancellation(t *testing.T) {
	conn := newIntegrationDatabase(t)
	second, err := pgx.ConnectConfig(context.Background(), conn.Config().Copy())
	if err != nil {
		t.Fatal("connect second migrator")
	}
	defer second.Close(context.Background())
	if _, err := conn.Exec(context.Background(), "SELECT pg_advisory_lock($1)", advisoryLockID); err != nil {
		t.Fatal(err)
	}
	defer conn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", advisoryLockID) //nolint:errcheck

	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	if err := Apply(ctx, second, canonicalMigrations(t)); err == nil {
		t.Fatal("expected blocked migrator to honor context cancellation")
	}
}

func canonicalMigrations(t *testing.T) []Migration {
	t.Helper()
	migrations, err := Discover(filepath.Join("..", "..", "migrations"))
	if err != nil {
		t.Fatal(err)
	}
	return migrations
}

func newIntegrationDatabase(t *testing.T) *pgx.Conn {
	t.Helper()
	baseURL := os.Getenv("QUORUM_MIGRATION_TEST_DATABASE_URL")
	if baseURL == "" {
		baseURL = os.Getenv("QUORUM_TEST_DATABASE_URL")
	}
	if baseURL == "" {
		if os.Getenv("QUORUM_REQUIRE_INTEGRATION") == "true" {
			t.Fatal("QUORUM_MIGRATION_TEST_DATABASE_URL or QUORUM_TEST_DATABASE_URL is required")
		}
		t.Skip("migration integration database is not configured")
	}
	baseConfig, err := pgx.ParseConfig(baseURL)
	if err != nil {
		t.Fatal("parse migration integration database configuration")
	}
	adminConfig := baseConfig.Copy()
	adminConfig.Database = "postgres"
	admin, err := pgx.ConnectConfig(context.Background(), adminConfig)
	if err != nil {
		t.Fatal("connect migration integration database administrator")
	}

	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		admin.Close(context.Background())
		t.Fatal(err)
	}
	databaseName := "quorum_migration_test_" + hex.EncodeToString(random)
	if _, err := admin.Exec(context.Background(), "CREATE DATABASE "+pgx.Identifier{databaseName}.Sanitize()); err != nil {
		admin.Close(context.Background())
		t.Fatal("create isolated migration integration database")
	}

	testConfig := baseConfig.Copy()
	testConfig.Database = databaseName
	conn, err := pgx.ConnectConfig(context.Background(), testConfig)
	if err != nil {
		_, _ = admin.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{databaseName}.Sanitize()+" WITH (FORCE)")
		admin.Close(context.Background())
		t.Fatal("connect isolated migration integration database")
	}
	t.Cleanup(func() {
		conn.Close(context.Background())
		_, _ = admin.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{databaseName}.Sanitize()+" WITH (FORCE)")
		admin.Close(context.Background())
	})
	return conn
}
