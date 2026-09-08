package migrate

import (
	"context"
	"testing"
)

func TestIntegrationReplayAfterGuardedPublicSchemaRecreation(t *testing.T) {
	conn := newIntegrationDatabase(t)
	if _, err := conn.Exec(context.Background(), `
		DROP SCHEMA public CASCADE;
		CREATE SCHEMA public;
	`); err != nil {
		t.Fatalf("recreate guarded-reset public schema: %v", err)
	}
	if err := Apply(context.Background(), conn, canonicalMigrations(t)); err != nil {
		t.Fatalf("canonical replay after guarded reset failed: %v", err)
	}
}
func TestIntegrationFailedMigrationRollsBackAndForwardFixApplies(t *testing.T) {
	conn := newIntegrationDatabase(t)
	migrations := canonicalMigrations(t)
	if err := Apply(context.Background(), conn, migrations); err != nil {
		t.Fatalf("apply canonical migrations: %v", err)
	}

	failing := Migration{
		Version:  "999998",
		Name:     "999998_forward_fix_probe.sql",
		SQL:      "CREATE TABLE public.forward_fix_probe (id integer PRIMARY KEY); SELECT missing_forward_fix_function();",
		Checksum: "expected-failing-checksum",
	}
	if err := Apply(context.Background(), conn, append(migrations, failing)); err == nil {
		t.Fatal("expected deliberately broken migration to fail")
	}

	var relationExists bool
	if err := conn.QueryRow(context.Background(), `
		SELECT to_regclass('public.forward_fix_probe') IS NOT NULL
	`).Scan(&relationExists); err != nil {
		t.Fatal(err)
	}
	if relationExists {
		t.Fatal("failed migration left a partially created table")
	}
	var ledgerRows int
	if err := conn.QueryRow(context.Background(), `
		SELECT count(*) FROM schema_migrations WHERE version = $1
	`, failing.Name).Scan(&ledgerRows); err != nil {
		t.Fatal(err)
	}
	if ledgerRows != 0 {
		t.Fatal("failed migration was recorded in the immutable ledger")
	}

	corrected := failing
	corrected.SQL = "CREATE TABLE public.forward_fix_probe (id integer PRIMARY KEY)"
	corrected.Checksum = "corrected-forward-fix-checksum"
	if err := Apply(context.Background(), conn, append(migrations, corrected)); err != nil {
		t.Fatalf("apply forward-fix migration: %v", err)
	}
	if err := conn.QueryRow(context.Background(), `
		SELECT to_regclass('public.forward_fix_probe') IS NOT NULL
	`).Scan(&relationExists); err != nil {
		t.Fatal(err)
	}
	if !relationExists {
		t.Fatal("corrected forward migration did not create its table")
	}
}
