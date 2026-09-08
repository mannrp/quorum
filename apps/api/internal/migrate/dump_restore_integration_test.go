package migrate

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestIntegrationCanonicalDumpRestoresWithOwnershipAndData(t *testing.T) {
	container := os.Getenv("QUORUM_POSTGRES_CONTAINER")
	if container == "" {
		if os.Getenv("QUORUM_REQUIRE_INTEGRATION") == "true" {
			t.Fatal("QUORUM_POSTGRES_CONTAINER is required for the dump/restore gate")
		}
		t.Skip("PostgreSQL container is not configured")
	}

	source := newIntegrationDatabase(t)
	if err := Apply(context.Background(), source, canonicalMigrations(t)); err != nil {
		t.Fatalf("apply canonical migrations: %v", err)
	}
	if _, err := source.Exec(context.Background(), `
		INSERT INTO public.users (auth_user_id, username, email, full_name)
		VALUES ('dump-auth-user', 'dump_user', 'dump@example.test', 'Dump Restore User')
	`); err != nil {
		t.Fatalf("insert dump fixture: %v", err)
	}

	baseURL := os.Getenv("QUORUM_MIGRATION_TEST_DATABASE_URL")
	if baseURL == "" {
		baseURL = os.Getenv("QUORUM_TEST_DATABASE_URL")
	}
	baseConfig, err := pgx.ParseConfig(baseURL)
	if err != nil {
		t.Fatal("parse migration integration database configuration")
	}
	adminConfig := baseConfig.Copy()
	adminConfig.Database = "postgres"
	admin, err := pgx.ConnectConfig(context.Background(), adminConfig)
	if err != nil {
		t.Fatal("connect restore database administrator")
	}
	defer admin.Close(context.Background())

	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		t.Fatal(err)
	}
	targetName := "quorum_restore_test_" + hex.EncodeToString(random)
	if _, err := admin.Exec(context.Background(), "CREATE DATABASE "+pgx.Identifier{targetName}.Sanitize()); err != nil {
		t.Fatal("create isolated restore database")
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{targetName}.Sanitize()+" WITH (FORCE)")
	})

	dumpPath := "/tmp/" + source.Config().Database + ".dump"
	runContainerCommand(t, container, "pg_dump", "-U", baseConfig.User, "-d", source.Config().Database, "--format=custom", "--file="+dumpPath)
	runContainerCommand(t, container, "pg_restore", "-U", baseConfig.User, "-d", targetName, "--exit-on-error", dumpPath)

	targetConfig := baseConfig.Copy()
	targetConfig.Database = targetName
	target, err := pgx.ConnectConfig(context.Background(), targetConfig)
	if err != nil {
		t.Fatal("connect restored database")
	}
	defer target.Close(context.Background())

	var migrationCount, fixtureCount int
	if err := target.QueryRow(context.Background(), "SELECT count(*) FROM public.schema_migrations").Scan(&migrationCount); err != nil {
		t.Fatal(err)
	}
	if err := target.QueryRow(context.Background(), "SELECT count(*) FROM public.users WHERE auth_user_id = 'dump-auth-user'").Scan(&fixtureCount); err != nil {
		t.Fatal(err)
	}
	if migrationCount != len(canonicalMigrations(t)) || fixtureCount != 1 {
		t.Fatalf("restored migration/data counts = %d/%d", migrationCount, fixtureCount)
	}
	for schema, owner := range map[string]string{
		"better_auth": "quorum_auth_owner",
		"app":         "quorum_app_owner",
		"integration": "quorum_integration_owner",
		"audit":       "quorum_audit_owner",
	} {
		var restoredOwner string
		if err := target.QueryRow(context.Background(), `
			SELECT owner.rolname
			FROM pg_namespace namespace
			JOIN pg_roles owner ON owner.oid = namespace.nspowner
			WHERE namespace.nspname = $1
		`, schema).Scan(&restoredOwner); err != nil {
			t.Fatal(err)
		}
		if restoredOwner != owner {
			t.Fatalf("restored schema %s owner = %s, want %s", schema, restoredOwner, owner)
		}
	}
}

func runContainerCommand(t *testing.T, container string, arguments ...string) {
	t.Helper()
	command := exec.CommandContext(context.Background(), "docker", append([]string{"exec", container}, arguments...)...)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("container command %s failed: %v: %s", arguments[0], err, string(output))
	}
	if len(output) > 0 {
		t.Logf("%s", fmt.Sprintf("%s completed", arguments[0]))
	}
}
