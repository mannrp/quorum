package migrate

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/dbroles"
)

func TestIntegrationAuthV2FoundationPrivileges(t *testing.T) {
	ctx := context.Background()
	conn := newIntegrationDatabase(t)
	if err := dbroles.Bootstrap(ctx, conn, dbroles.Config{
		OperatorURL:         conn.Config().ConnString(),
		MigratorPassword:    "privilege-test-migrator-only",
		AuthRuntimePassword: "privilege-test-auth-only",
		AppRuntimePassword:  "privilege-test-app-only",
	}); err != nil {
		t.Fatalf("bootstrap isolated database roles: %v", err)
	}
	if err := Apply(ctx, conn, canonicalMigrations(t)); err != nil {
		t.Fatalf("apply canonical migrations: %v", err)
	}

	owners := map[string]string{
		"better_auth": "quorum_auth_owner",
		"app":         "quorum_app_owner",
		"integration": "quorum_integration_owner",
		"audit":       "quorum_audit_owner",
	}
	for schema, wantOwner := range owners {
		var owner string
		if err := conn.QueryRow(ctx, `
			SELECT pg_get_userbyid(nspowner)
			FROM pg_namespace
			WHERE nspname = $1
		`, schema).Scan(&owner); err != nil {
			t.Fatalf("read owner for schema %s: %v", schema, err)
		}
		if owner != wantOwner {
			t.Errorf("schema %s owner = %s, want %s", schema, owner, wantOwner)
		}
	}

	assertSchemaPrivilege(t, conn, "quorum_auth_runtime", "better_auth", "USAGE", true)
	assertSchemaPrivilege(t, conn, "quorum_auth_runtime", "app", "USAGE", false)
	assertSchemaPrivilege(t, conn, "quorum_app_runtime", "app", "USAGE", true)
	assertSchemaPrivilege(t, conn, "quorum_app_runtime", "better_auth", "USAGE", false)
	assertSchemaPrivilege(t, conn, "quorum_app_runtime", "public", "USAGE", true)
	assertSchemaPrivilege(t, conn, "quorum_auth_runtime", "public", "USAGE", false)
	for _, privilege := range []string{"SELECT", "INSERT", "UPDATE", "DELETE"} {
		assertTablePrivilege(t, conn, "quorum_app_runtime", "public", "users", privilege, true)
		assertTablePrivilege(t, conn, "quorum_auth_runtime", "public", "users", privilege, false)
	}
	for _, schema := range []string{"better_auth", "app", "integration", "audit"} {
		assertPublicSchemaPrivilege(t, conn, schema, "USAGE", false)
		assertSchemaPrivilege(t, conn, "quorum_auth_runtime", schema, "CREATE", false)
		assertSchemaPrivilege(t, conn, "quorum_app_runtime", schema, "CREATE", false)
	}

	for _, table := range []string{"user", "session", "account", "verification", "twoFactor", "rateLimit"} {
		for _, privilege := range []string{"SELECT", "INSERT", "UPDATE", "DELETE"} {
			assertTablePrivilege(t, conn, "quorum_auth_runtime", "better_auth", table, privilege, true)
			assertTablePrivilege(t, conn, "quorum_app_runtime", "better_auth", table, privilege, false)
		}
	}
	for _, table := range []string{"identity_realms", "user_identities", "account_states", "role_grants", "role_invitations"} {
		for _, privilege := range []string{"SELECT", "INSERT", "UPDATE", "DELETE"} {
			assertTablePrivilege(t, conn, "quorum_app_runtime", "app", table, privilege, true)
			assertTablePrivilege(t, conn, "quorum_auth_runtime", "app", table, privilege, false)
		}
	}
	assertSchemaPrivilege(t, conn, "quorum_audit_reader", "audit", "USAGE", true)
	assertTablePrivilege(t, conn, "quorum_audit_reader", "audit", "events", "SELECT", true)
	assertTablePrivilege(t, conn, "quorum_audit_reader", "audit", "events", "INSERT", false)
	for _, schema := range []string{"better_auth", "app", "integration"} {
		assertSchemaPrivilege(t, conn, "quorum_audit_reader", schema, "USAGE", false)
	}
	for _, role := range []string{"quorum_auth_runtime", "quorum_app_runtime"} {
		assertTablePrivilege(t, conn, role, "integration", "outbox_events", "SELECT", true)
		assertTablePrivilege(t, conn, role, "integration", "outbox_events", "INSERT", true)
		assertTablePrivilege(t, conn, role, "integration", "outbox_events", "UPDATE", false)
		assertTablePrivilege(t, conn, role, "integration", "inbox_events", "SELECT", false)
		assertTablePrivilege(t, conn, role, "audit", "events", "INSERT", true)
		assertTablePrivilege(t, conn, role, "audit", "events", "SELECT", false)
	}

	if _, err := conn.Exec(ctx, `
		BEGIN;
		SET LOCAL ROLE quorum_auth_owner;
		CREATE TABLE better_auth.default_privilege_probe (id text PRIMARY KEY);
		RESET ROLE;
		SET LOCAL ROLE quorum_app_owner;
		CREATE TABLE app.default_privilege_probe (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
		RESET ROLE;
		COMMIT;
	`); err != nil {
		t.Fatalf("create default privilege probes: %v", err)
	}
	for _, privilege := range []string{"SELECT", "INSERT", "UPDATE", "DELETE"} {
		assertTablePrivilege(t, conn, "quorum_auth_runtime", "better_auth", "default_privilege_probe", privilege, true)
		assertTablePrivilege(t, conn, "quorum_app_runtime", "app", "default_privilege_probe", privilege, true)
	}
}

type privilegeQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func assertSchemaPrivilege(t *testing.T, conn privilegeQuerier, role, schema, privilege string, want bool) {
	t.Helper()
	var got bool
	if err := conn.QueryRow(
		context.Background(),
		"SELECT has_schema_privilege($1, $2, $3)",
		role,
		schema,
		privilege,
	).Scan(&got); err != nil {
		t.Fatalf("inspect %s %s on schema %s: %v", role, privilege, schema, err)
	}
	if got != want {
		t.Errorf("%s has %s on schema %s = %v, want %v", role, privilege, schema, got, want)
	}
}

func assertPublicSchemaPrivilege(t *testing.T, conn privilegeQuerier, schema, privilege string, want bool) {
	t.Helper()
	var got bool
	if err := conn.QueryRow(
		context.Background(),
		`SELECT EXISTS (
			SELECT 1
			FROM pg_namespace namespace
			CROSS JOIN LATERAL aclexplode(
				COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
			) privilege
			WHERE namespace.nspname = $1
			  AND privilege.grantee = 0
			  AND privilege.privilege_type = $2
		)`,
		schema,
		privilege,
	).Scan(&got); err != nil {
		t.Fatalf("inspect PUBLIC %s on schema %s: %v", privilege, schema, err)
	}
	if got != want {
		t.Errorf("PUBLIC has %s on schema %s = %v, want %v", privilege, schema, got, want)
	}
}
func assertTablePrivilege(t *testing.T, conn privilegeQuerier, role, schema, table, privilege string, want bool) {
	t.Helper()
	var got bool
	if err := conn.QueryRow(
		context.Background(),
		"SELECT has_table_privilege($1, format('%I.%I', $2::text, $3::text), $4)",
		role,
		schema,
		table,
		privilege,
	).Scan(&got); err != nil {
		t.Fatalf("inspect %s %s on %s.%s: %v", role, privilege, schema, table, err)
	}
	if got != want {
		t.Errorf("%s has %s on %s.%s = %v, want %v", role, privilege, schema, table, got, want)
	}
}
