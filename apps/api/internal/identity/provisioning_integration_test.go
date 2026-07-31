package identity

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	quorummigrate "github.com/local/quorum/apps/api/internal/migrate"
)

func TestIntegrationProvisionIsIdempotentAndCollisionSafe(t *testing.T) {
	ctx := context.Background()
	pool := newIdentityIntegrationDatabase(t)
	service := NewService(pool)
	input := ProvisionInput{
		RealmKey:        "quorum-primary",
		AuthSystem:      "BETTER_AUTH",
		Issuer:          "https://auth.example.test",
		IdentitySubject: "better-auth-user-1",
		EnrollmentRole:  RoleStudent,
		VerifiedEmail:   "verified@example.test",
	}

	results := make(chan ProvisionResult, 2)
	errorsSeen := make(chan error, 2)
	var wait sync.WaitGroup
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			result, err := service.Provision(ctx, input)
			results <- result
			errorsSeen <- err
		}()
	}
	wait.Wait()
	close(results)
	close(errorsSeen)
	for err := range errorsSeen {
		if err != nil {
			t.Fatalf("concurrent provision failed: %v", err)
		}
	}
	var userID string
	created := 0
	for result := range results {
		if userID == "" {
			userID = result.UserID
		}
		if result.UserID != userID {
			t.Fatalf("duplicate provision returned users %s and %s", userID, result.UserID)
		}
		if result.Created {
			created++
		}
	}
	if created != 1 {
		t.Fatalf("created results = %d, want 1", created)
	}

	assertCount(t, pool, "SELECT count(*) FROM public.users WHERE id::text = $1", 1, userID)
	assertCount(t, pool, `SELECT count(*) FROM app.user_identities WHERE user_id::text = $1`, 1, userID)
	assertCount(t, pool, `SELECT count(*) FROM app.account_states WHERE user_id::text = $1`, 1, userID)
	assertCount(t, pool, `SELECT count(*) FROM app.role_grants WHERE user_id::text = $1 AND revoked_at IS NULL`, 1, userID)
	assertCount(t, pool, `SELECT count(*) FROM integration.outbox_events WHERE aggregate_id = $1`, 1, userID)
	assertCount(t, pool, `SELECT count(*) FROM audit.events WHERE target_id = $1`, 1, userID)

	retry, err := service.Provision(ctx, ProvisionInput{
		RealmKey:        input.RealmKey,
		AuthSystem:      input.AuthSystem,
		Issuer:          input.Issuer,
		IdentitySubject: input.IdentitySubject,
		EnrollmentRole:  input.EnrollmentRole,
		VerifiedEmail:   "changed@example.test",
	})
	if err != nil {
		t.Fatalf("returning identity provision failed: %v", err)
	}
	if retry.Created || retry.UserID != userID {
		t.Fatalf("returning identity result = %+v, want existing %s", retry, userID)
	}

	_, err = service.Provision(ctx, ProvisionInput{
		RealmKey:        input.RealmKey,
		AuthSystem:      input.AuthSystem,
		Issuer:          "https://different-auth.example.test",
		IdentitySubject: "another-subject",
		EnrollmentRole:  RoleStudent,
	})
	if !errors.Is(err, ErrRealmConflict) {
		t.Fatalf("realm collision error = %v, want ErrRealmConflict", err)
	}

	_, err = service.Provision(ctx, ProvisionInput{
		RealmKey:        input.RealmKey,
		AuthSystem:      input.AuthSystem,
		Issuer:          input.Issuer,
		IdentitySubject: "different-auth-user",
		EnrollmentRole:  RoleStudent,
		VerifiedEmail:   input.VerifiedEmail,
	})
	if !errors.Is(err, ErrEmailConflict) {
		t.Fatalf("same-email collision error = %v, want ErrEmailConflict", err)
	}
	assertCount(t, pool, `SELECT count(*) FROM app.user_identities`, 1)
	assertCount(t, pool, `SELECT count(*) FROM public.users`, 1)

	_, err = service.Provision(ctx, ProvisionInput{
		RealmKey:        input.RealmKey,
		AuthSystem:      input.AuthSystem,
		Issuer:          input.Issuer,
		IdentitySubject: input.IdentitySubject,
		EnrollmentRole:  RoleSponsor,
	})
	if !errors.Is(err, ErrRoleConflict) {
		t.Fatalf("role collision error = %v, want ErrRoleConflict", err)
	}
}

func newIdentityIntegrationDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	baseURL := os.Getenv("QUORUM_TEST_DATABASE_URL")
	if baseURL == "" {
		if os.Getenv("QUORUM_REQUIRE_INTEGRATION") == "true" {
			t.Fatal("QUORUM_TEST_DATABASE_URL is required when QUORUM_REQUIRE_INTEGRATION=true")
		}
		t.Skip("identity integration database is not configured")
	}
	ctx := context.Background()
	baseConfig, err := pgx.ParseConfig(baseURL)
	if err != nil {
		t.Fatal("parse identity integration database configuration")
	}
	adminConfig := baseConfig.Copy()
	adminConfig.Database = "postgres"
	admin, err := pgx.ConnectConfig(ctx, adminConfig)
	if err != nil {
		t.Fatal("connect identity integration database administrator")
	}
	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		admin.Close(ctx)
		t.Fatal(err)
	}
	databaseName := "quorum_identity_test_" + hex.EncodeToString(random)
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{databaseName}.Sanitize()); err != nil {
		admin.Close(ctx)
		t.Fatal("create isolated identity integration database")
	}

	testConfig := baseConfig.Copy()
	testConfig.Database = databaseName
	conn, err := pgx.ConnectConfig(ctx, testConfig)
	if err != nil {
		_, _ = admin.Exec(ctx, "DROP DATABASE "+pgx.Identifier{databaseName}.Sanitize()+" WITH (FORCE)")
		admin.Close(ctx)
		t.Fatal("connect isolated identity integration database")
	}
	migrations, err := quorummigrate.Discover(filepath.Join("..", "..", "migrations"))
	if err == nil {
		err = quorummigrate.Apply(ctx, conn, migrations)
	}
	conn.Close(ctx)
	if err != nil {
		_, _ = admin.Exec(ctx, "DROP DATABASE "+pgx.Identifier{databaseName}.Sanitize()+" WITH (FORCE)")
		admin.Close(ctx)
		t.Fatalf("apply identity integration migrations: %v", err)
	}

	poolConfig, err := pgxpool.ParseConfig(baseURL)
	if err != nil {
		t.Fatal("parse identity pool configuration")
	}
	poolConfig.ConnConfig.Database = databaseName
	poolConfig.MaxConns = 4
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		t.Fatal("create identity integration pool")
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP DATABASE "+pgx.Identifier{databaseName}.Sanitize()+" WITH (FORCE)")
		admin.Close(ctx)
	})
	return pool
}

type rowQuerier interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func assertCount(t *testing.T, querier rowQuerier, query string, want int, args ...any) {
	t.Helper()
	var got int
	if err := querier.QueryRow(context.Background(), query, args...).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("count = %d, want %d", got, want)
	}
}
