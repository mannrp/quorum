package migrate

import (
	"context"
	"testing"
)

func TestIntegrationAuthV2FoundationCatalog(t *testing.T) {
	conn := newIntegrationDatabase(t)
	if err := Apply(context.Background(), conn, canonicalMigrations(t)); err != nil {
		t.Fatalf("apply canonical migrations: %v", err)
	}

	for _, schema := range []string{"better_auth", "app", "integration", "audit"} {
		var exists bool
		if err := conn.QueryRow(context.Background(), `
			SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1)
		`, schema).Scan(&exists); err != nil {
			t.Fatalf("inspect schema %s: %v", schema, err)
		}
		if !exists {
			t.Errorf("required schema %s does not exist", schema)
		}
	}

	expectedTables := map[string][]string{
		"better_auth": {"account", "rateLimit", "session", "twoFactor", "user", "verification"},
		"app": {
			"account_states",
			"identity_realms",
			"role_grants",
			"role_invitations",
			"user_identities",
		},
		"integration": {"inbox_events", "outbox_events", "reconciliation_state"},
		"audit":       {"events"},
	}
	for schema, tables := range expectedTables {
		for _, table := range tables {
			var exists bool
			if err := conn.QueryRow(context.Background(), `
				SELECT EXISTS (
					SELECT 1
					FROM pg_class relation
					JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
					WHERE namespace.nspname = $1
					  AND relation.relname = $2
					  AND relation.relkind IN ('r', 'p')
				)
			`, schema, table).Scan(&exists); err != nil {
				t.Fatalf("inspect table %s.%s: %v", schema, table, err)
			}
			if !exists {
				t.Errorf("required table %s.%s does not exist", schema, table)
			}
		}
	}

	for _, schema := range []string{"public", "auth"} {
		var count int
		if err := conn.QueryRow(context.Background(), `
			SELECT count(*)
			FROM pg_class relation
			JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
			WHERE namespace.nspname = $1
			  AND relation.relname = ANY($2::text[])
		`, schema, expectedTables["better_auth"]).Scan(&count); err != nil {
			t.Fatalf("inspect forbidden auth objects in %s: %v", schema, err)
		}
		if count != 0 {
			t.Errorf("found %d Better Auth objects in forbidden schema %s", count, schema)
		}
	}

	var legacyBindingPreserved bool
	if err := conn.QueryRow(context.Background(), `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = 'users'
			  AND column_name = 'auth_user_id'
		)
	`).Scan(&legacyBindingPreserved); err != nil {
		t.Fatal(err)
	}
	if !legacyBindingPreserved {
		t.Error("legacy public.users.auth_user_id was removed before domain migration")
	}
}
