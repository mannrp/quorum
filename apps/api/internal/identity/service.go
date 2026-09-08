package identity

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type EnrollmentRole string

const (
	RoleStudent EnrollmentRole = "STUDENT"
	RoleSponsor EnrollmentRole = "SPONSOR"
)

var (
	ErrInvalidInput  = errors.New("invalid identity provisioning input")
	ErrRealmConflict = errors.New("identity realm configuration conflict")
	ErrEmailConflict = errors.New("verified email belongs to another product user")
	ErrRoleConflict  = errors.New("self-service enrollment role conflict")
)

type ProvisionInput struct {
	RealmKey        string
	AuthSystem      string
	Issuer          string
	IdentitySubject string
	EnrollmentRole  EnrollmentRole
	VerifiedEmail   string
}

type ProvisionResult struct {
	UserID  string
	Created bool
}

type beginner interface {
	Begin(context.Context) (pgx.Tx, error)
}

type Service struct {
	database beginner
}

func NewService(database beginner) *Service {
	return &Service{database: database}
}

func (s *Service) Provision(ctx context.Context, input ProvisionInput) (result ProvisionResult, err error) {
	if err := validateProvisionInput(input); err != nil {
		return ProvisionResult{}, err
	}
	tx, err := s.database.Begin(ctx)
	if err != nil {
		return ProvisionResult{}, fmt.Errorf("begin identity provisioning: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(context.Background())
		}
	}()

	var realmID string
	var authSystem string
	var issuer *string
	if _, err = tx.Exec(ctx, `
		INSERT INTO app.identity_realms (realm_key, auth_system, issuer)
		VALUES ($1, $2, NULLIF($3, ''))
		ON CONFLICT (realm_key) DO NOTHING
	`, input.RealmKey, input.AuthSystem, input.Issuer); err != nil {
		return ProvisionResult{}, fmt.Errorf("ensure identity realm: %w", err)
	}
	if err = tx.QueryRow(ctx, `
		SELECT id::text, auth_system, issuer
		FROM app.identity_realms
		WHERE realm_key = $1
	`, input.RealmKey).Scan(&realmID, &authSystem, &issuer); err != nil {
		return ProvisionResult{}, fmt.Errorf("read identity realm: %w", err)
	}
	if authSystem != input.AuthSystem || nullableString(issuer) != input.Issuer {
		return ProvisionResult{}, ErrRealmConflict
	}

	if _, err = tx.Exec(ctx, `
		SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
	`, realmID+":"+input.IdentitySubject); err != nil {
		return ProvisionResult{}, fmt.Errorf("lock identity provisioning key: %w", err)
	}

	var existingUserID string
	var existingRole string
	err = tx.QueryRow(ctx, `
		SELECT identity.user_id::text, grant_record.role
		FROM app.user_identities identity
		JOIN app.role_grants grant_record
		  ON grant_record.user_id = identity.user_id
		 AND grant_record.source = 'SELF_SERVICE'
		 AND grant_record.revoked_at IS NULL
		WHERE identity.realm_id = $1::uuid
		  AND identity.identity_subject = $2
	`, realmID, input.IdentitySubject).Scan(&existingUserID, &existingRole)
	if err == nil {
		if existingRole != string(input.EnrollmentRole) {
			return ProvisionResult{}, ErrRoleConflict
		}
		if _, err = tx.Exec(ctx, `
			UPDATE app.user_identities
			SET last_seen_at = now(), updated_at = now()
			WHERE realm_id = $1::uuid AND identity_subject = $2
		`, realmID, input.IdentitySubject); err != nil {
			return ProvisionResult{}, fmt.Errorf("touch existing identity: %w", err)
		}
		if err = tx.Commit(ctx); err != nil {
			return ProvisionResult{}, fmt.Errorf("commit existing identity: %w", err)
		}
		return ProvisionResult{UserID: existingUserID, Created: false}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return ProvisionResult{}, fmt.Errorf("resolve existing identity: %w", err)
	}

	var userID string
	err = tx.QueryRow(ctx, `
		WITH generated AS (SELECT gen_random_uuid() AS id)
		INSERT INTO public.users (id, auth_user_id, username, email, full_name)
		SELECT
		  id,
		  'authv2:' || id::text,
		  'user_' || replace(id::text, '-', ''),
		  NULLIF($1, ''),
		  'New user'
		FROM generated
		RETURNING id::text
	`, input.VerifiedEmail).Scan(&userID)
	if err != nil {
		if isConstraint(err, "users_email_key") {
			return ProvisionResult{}, ErrEmailConflict
		}
		return ProvisionResult{}, fmt.Errorf("create product user: %w", err)
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO app.user_identities (
		  user_id, realm_id, identity_subject, verified_email, email_verified_at,
		  last_seen_at, last_synced_at
		)
		VALUES (
		  $1::uuid, $2::uuid, $3, NULLIF($4, ''),
		  CASE WHEN $4 = '' THEN NULL ELSE now() END,
		  now(), now()
		)
	`, userID, realmID, input.IdentitySubject, input.VerifiedEmail); err != nil {
		return ProvisionResult{}, fmt.Errorf("bind product identity: %w", err)
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO app.account_states (user_id) VALUES ($1::uuid)
	`, userID); err != nil {
		return ProvisionResult{}, fmt.Errorf("create account state: %w", err)
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO app.role_grants (user_id, role, source)
		VALUES ($1::uuid, $2, 'SELF_SERVICE')
	`, userID, string(input.EnrollmentRole)); err != nil {
		return ProvisionResult{}, fmt.Errorf("create enrollment grant: %w", err)
	}

	var eventID string
	if err = tx.QueryRow(ctx, `
		INSERT INTO integration.outbox_events (
		  aggregate_type, aggregate_id, aggregate_version, event_type, payload,
		  idempotency_key
		)
		VALUES (
		  'USER', $1::text, 1, 'IDENTITY_PROVISIONED',
		  jsonb_build_object('userId', $1::text, 'realmKey', $2::text),
		  'identity-provisioned:' || $3::text || ':' || $4::text
		)
		RETURNING id::text
	`, userID, input.RealmKey, realmID, input.IdentitySubject).Scan(&eventID); err != nil {
		return ProvisionResult{}, fmt.Errorf("enqueue identity event: %w", err)
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO audit.events (
		  actor_kind, action, target_type, target_id, source_event_id, metadata
		)
		VALUES (
		  'SYSTEM', 'IDENTITY_PROVISIONED', 'USER', $1::text, $2::uuid,
		  jsonb_build_object('realmKey', $3::text, 'enrollmentRole', $4::text)
		)
	`, userID, eventID, input.RealmKey, string(input.EnrollmentRole)); err != nil {
		return ProvisionResult{}, fmt.Errorf("audit identity provision: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return ProvisionResult{}, fmt.Errorf("commit identity provisioning: %w", err)
	}
	return ProvisionResult{UserID: userID, Created: true}, nil
}

func validateProvisionInput(input ProvisionInput) error {
	if input.RealmKey == "" || strings.TrimSpace(input.RealmKey) != input.RealmKey {
		return ErrInvalidInput
	}
	if input.AuthSystem != "BETTER_AUTH" {
		return ErrInvalidInput
	}
	if strings.TrimSpace(input.Issuer) != input.Issuer {
		return ErrInvalidInput
	}
	if input.IdentitySubject == "" || strings.TrimSpace(input.IdentitySubject) != input.IdentitySubject {
		return ErrInvalidInput
	}
	if input.EnrollmentRole != RoleStudent && input.EnrollmentRole != RoleSponsor {
		return ErrInvalidInput
	}
	if strings.TrimSpace(input.VerifiedEmail) != input.VerifiedEmail || strings.ToLower(input.VerifiedEmail) != input.VerifiedEmail {
		return ErrInvalidInput
	}
	return nil
}

func nullableString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func isConstraint(err error, constraint string) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.ConstraintName == constraint
}
