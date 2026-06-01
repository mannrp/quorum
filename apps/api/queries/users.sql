-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1;

-- name: GetUserByAuthID :one
SELECT * FROM users WHERE auth_user_id = $1;

-- name: ListUsers :many
SELECT DISTINCT u.*
FROM users u
LEFT JOIN user_tags ut ON ut.user_id = u.id
LEFT JOIN tags t ON t.id = ut.tag_id
WHERE (sqlc.narg('discipline')::text IS NULL OR u.discipline = sqlc.narg('discipline')::text)
  AND (sqlc.narg('tag')::text IS NULL OR t.name = sqlc.narg('tag')::text)
  AND (
    sqlc.narg('search')::text IS NULL
    OR u.username ILIKE '%' || sqlc.narg('search')::text || '%'
    OR u.full_name ILIKE '%' || sqlc.narg('search')::text || '%'
  )
ORDER BY u.full_name;

-- name: ListUserTags :many
SELECT t.*
FROM tags t
JOIN user_tags ut ON ut.tag_id = t.id
WHERE ut.user_id = $1
ORDER BY t.name;

-- name: CreateUser :one
INSERT INTO users (auth_user_id, username, email, full_name, discipline, university)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateProfile :one
UPDATE users
SET full_name = $2,
    bio = $3,
    discipline = $4,
    university = $5,
    linkedin_url = $6,
    github_url = $7,
    portfolio_url = $8,
    resume_url = $9,
    avatar_url = $10,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;
