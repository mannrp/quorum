package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/localdb"
	quorummigrate "github.com/local/quorum/apps/api/internal/migrate"
)

func main() {
	if len(os.Args) < 2 {
		fatal("usage: localdb <init|reset> [options]")
	}
	flags := flag.NewFlagSet("localdb "+os.Args[1], flag.ExitOnError)
	markerFile := flags.String("marker-file", "../../.quorum/local-instance-id", "ignored host marker path")
	migrationDir := flags.String("migrations", "migrations", "canonical migration directory")
	if err := flags.Parse(os.Args[2:]); err != nil {
		fatal(err.Error())
	}

	databaseURL := os.Getenv("LOCAL_TEST_DATABASE_URL")
	if databaseURL == "" {
		fatal("LOCAL_TEST_DATABASE_URL is required")
	}
	if err := localdb.ValidateResetTarget(databaseURL); err != nil {
		fatal(err.Error())
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		fatal(fmt.Sprintf("connect to guarded local database: %v", err))
	}
	defer conn.Close(ctx)

	switch os.Args[1] {
	case "init":
		if err := initialize(ctx, conn, *markerFile); err != nil {
			fatal(err.Error())
		}
		fmt.Println("local database identity initialized and verified")
	case "reset":
		if os.Getenv("QUORUM_ALLOW_LOCAL_RESET") != "true" {
			fatal("QUORUM_ALLOW_LOCAL_RESET=true is required")
		}
		if err := reset(ctx, conn, *markerFile, *migrationDir); err != nil {
			fatal(err.Error())
		}
		fmt.Println("guarded local database reset completed")
	default:
		fatal("usage: localdb <init|reset> [options]")
	}
}

func initialize(ctx context.Context, conn *pgx.Conn, markerFile string) error {
	hostMarker, err := readOrCreateMarker(markerFile)
	if err != nil {
		return err
	}
	if _, err := conn.Exec(ctx, `
		CREATE SCHEMA IF NOT EXISTS quorum_meta;
		CREATE TABLE IF NOT EXISTS quorum_meta.environment_identity (
			singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
			instance_id TEXT UNIQUE NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("create local identity record: %w", err)
	}
	var databaseMarker string
	err = conn.QueryRow(ctx, `
		INSERT INTO quorum_meta.environment_identity (singleton, instance_id)
		VALUES (TRUE, $1)
		ON CONFLICT (singleton) DO UPDATE SET instance_id = quorum_meta.environment_identity.instance_id
		RETURNING instance_id
	`, hostMarker).Scan(&databaseMarker)
	if err != nil {
		return fmt.Errorf("read local identity record: %w", err)
	}
	return localdb.ValidateMarker(hostMarker, databaseMarker)
}

func reset(ctx context.Context, conn *pgx.Conn, markerFile, migrationDir string) error {
	hostBytes, err := os.ReadFile(markerFile)
	if err != nil {
		return fmt.Errorf("read host instance marker: %w", err)
	}
	hostMarker := strings.TrimSpace(string(hostBytes))
	var databaseMarker string
	if err := conn.QueryRow(ctx, "SELECT instance_id FROM quorum_meta.environment_identity WHERE singleton = TRUE").Scan(&databaseMarker); err != nil {
		return fmt.Errorf("read database instance marker: %w", err)
	}
	if err := localdb.ValidateMarker(hostMarker, databaseMarker); err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin guarded reset: %w", err)
	}
	_, err = tx.Exec(ctx, `
		DROP SCHEMA IF EXISTS better_auth CASCADE;
		DROP SCHEMA IF EXISTS app CASCADE;
		DROP SCHEMA IF EXISTS integration CASCADE;
		DROP SCHEMA IF EXISTS audit CASCADE;
		DROP SCHEMA IF EXISTS public CASCADE;
		CREATE SCHEMA public;
		REVOKE ALL ON SCHEMA public FROM PUBLIC, quorum_auth_runtime, quorum_app_runtime, quorum_audit_reader;
		GRANT USAGE, CREATE ON SCHEMA public TO quorum_migrator;
		GRANT USAGE ON SCHEMA public TO quorum_app_owner, quorum_audit_owner, quorum_app_runtime;	`)
	if err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("reset local schemas: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit guarded reset: %w", err)
	}

	migrations, err := quorummigrate.Discover(migrationDir)
	if err != nil {
		return err
	}
	return quorummigrate.Apply(ctx, conn, migrations)
}

func readOrCreateMarker(path string) (string, error) {
	if body, err := os.ReadFile(path); err == nil {
		marker := strings.TrimSpace(string(body))
		if marker == "" {
			return "", fmt.Errorf("host instance marker is empty")
		}
		return marker, nil
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("read host instance marker: %w", err)
	}

	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate host instance marker: %w", err)
	}
	marker := hex.EncodeToString(bytes)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", fmt.Errorf("create marker directory: %w", err)
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", fmt.Errorf("create host instance marker: %w", err)
	}
	if _, err := file.WriteString(marker + "\n"); err != nil {
		_ = file.Close()
		return "", fmt.Errorf("write host instance marker: %w", err)
	}
	if err := file.Close(); err != nil {
		return "", fmt.Errorf("close host instance marker: %w", err)
	}
	return marker, nil
}

func fatal(message string) {
	fmt.Fprintln(os.Stderr, "localdb:", message)
	os.Exit(1)
}
