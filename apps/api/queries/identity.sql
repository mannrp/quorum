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
