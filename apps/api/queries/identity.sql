-- name: GetIdentityRealmByKey :one
SELECT id, realm_key, auth_system, issuer, created_at, updated_at
FROM app.identity_realms
WHERE realm_key = $1;

-- name: GetUserIdentityByRealmSubject :one
SELECT identity.*
FROM app.user_identities AS identity
JOIN app.identity_realms AS realm ON realm.id = identity.realm_id
WHERE realm.realm_key = $1
  AND identity.identity_subject = $2
  AND identity.unlinked_at IS NULL;

-- name: ListActiveRoleGrantsForUser :many
SELECT grant_record.*
FROM app.role_grants AS grant_record
WHERE grant_record.user_id = $1
  AND grant_record.revoked_at IS NULL
ORDER BY grant_record.granted_at, grant_record.id;
-- name: DeactivateAccountState :execrows
UPDATE app.account_states
SET status = 'DEACTIVATED',
    state_version = state_version + 1,
    session_revocation_version = session_revocation_version + 1,
    deactivated_at = now(),
    updated_at = now()
WHERE user_id = $1
  AND status = 'ACTIVE';

-- name: GetViewerBootstrapByRealmSubject :one
SELECT
  product_user.id::text AS product_user_id,
  account.status AS account_state,
  identity.sync_status,
  CASE WHEN product_user.profile_complete THEN 'COMPLETE' ELSE 'NOT_STARTED' END::text AS onboarding_state,
  (CASE WHEN product_user.username LIKE 'user_%' THEN '' ELSE product_user.username END)::text AS username,
  (CASE WHEN product_user.full_name = 'New user' THEN '' ELSE product_user.full_name END)::text AS display_name,
  COALESCE(
    array_agg(grant_record.role ORDER BY grant_record.role)
      FILTER (
        WHERE grant_record.source = 'SELF_SERVICE'
          AND grant_record.revoked_at IS NULL
          AND grant_record.role IN ('STUDENT', 'SPONSOR')
      ),
    ARRAY[]::text[]
  )::text[] AS self_service_roles
FROM app.user_identities AS identity
JOIN app.identity_realms AS realm ON realm.id = identity.realm_id
JOIN public.users AS product_user ON product_user.id = identity.user_id
JOIN app.account_states AS account ON account.user_id = product_user.id
LEFT JOIN app.role_grants AS grant_record ON grant_record.user_id = product_user.id
WHERE realm.realm_key = $1
  AND identity.identity_subject = $2
  AND identity.unlinked_at IS NULL
GROUP BY product_user.id, account.status, identity.sync_status;
