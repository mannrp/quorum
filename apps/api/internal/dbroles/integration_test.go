package dbroles

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestIntegrationBootstrapIsIdempotentAndLeastPrivilege(t *testing.T) {
	operatorURL := os.Getenv("QUORUM_ROLE_TEST_DATABASE_URL")
	if operatorURL == "" {
		operatorURL = os.Getenv("QUORUM_TEST_DATABASE_URL")
	}
	if operatorURL == "" {
		if os.Getenv("QUORUM_REQUIRE_INTEGRATION") == "true" {
			t.Fatal("QUORUM_ROLE_TEST_DATABASE_URL or QUORUM_TEST_DATABASE_URL is required")
		}
		t.Skip("role bootstrap integration database is not configured")
	}
	conn, err := pgx.Connect(context.Background(), operatorURL)
	if err != nil {
		t.Fatal("connect role bootstrap integration database")
	}
	defer conn.Close(context.Background())
	config := Config{
		OperatorURL:         operatorURL,
		MigratorPassword:    "ci-migrator-password-not-for-production",
		AuthRuntimePassword: "ci-auth-password-not-for-production",
		AppRuntimePassword:  "ci-app-password-not-for-production",
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := Bootstrap(context.Background(), conn, config); err != nil {
			t.Fatalf("bootstrap attempt %d failed: %v", attempt+1, err)
		}
	}

	for _, role := range []string{"quorum_app_owner", "quorum_auth_owner", "quorum_integration_owner", "quorum_audit_owner"} {
		assertRoleAttributes(t, conn, role, false)
	}
	for _, role := range []string{"quorum_migrator", "quorum_auth_runtime", "quorum_app_runtime"} {
		assertRoleAttributes(t, conn, role, true)
	}
	var canCreate bool
	if err := conn.QueryRow(context.Background(), "SELECT has_schema_privilege('quorum_app_runtime', 'public', 'CREATE')").Scan(&canCreate); err != nil {
		t.Fatal(err)
	}
	if canCreate {
		t.Fatal("app runtime unexpectedly has CREATE on public schema")
	}
}

func assertRoleAttributes(t *testing.T, conn *pgx.Conn, role string, wantLogin bool) {
	t.Helper()
	var login, superuser, createDB, createRole, inherit bool
	err := conn.QueryRow(context.Background(), `
		SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit
		FROM pg_roles WHERE rolname = $1
	`, role).Scan(&login, &superuser, &createDB, &createRole, &inherit)
	if err != nil {
		t.Fatalf("inspect role %s: %v", role, err)
	}
	if login != wantLogin || superuser || createDB || createRole || inherit {
		t.Fatalf("unsafe attributes for role %s: login=%v super=%v createdb=%v createrole=%v inherit=%v", role, login, superuser, createDB, createRole, inherit)
	}
}
