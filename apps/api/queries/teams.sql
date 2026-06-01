-- name: GetTeam :one
SELECT * FROM teams WHERE id = $1;

-- name: ListTeams :many
SELECT *
FROM teams
WHERE (sqlc.narg('discipline')::text IS NULL OR discipline = sqlc.narg('discipline')::text)
  AND (sqlc.narg('has_project')::boolean IS NULL OR (project_id IS NOT NULL) = sqlc.narg('has_project')::boolean)
  AND (sqlc.narg('is_complete')::boolean IS NULL OR is_complete = sqlc.narg('is_complete')::boolean)
  AND (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY created_at DESC;

-- name: ListTeamMembers :many
SELECT tm.*, u.username, u.full_name, u.discipline, u.university
FROM team_memberships tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1
ORDER BY tm.joined_at;

-- name: CreateTeam :one
INSERT INTO teams (name, description, discipline, max_size, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: AddTeamMember :one
INSERT INTO team_memberships (team_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateTeam :one
UPDATE teams
SET name = $2,
    description = $3,
    discipline = $4,
    max_size = $5,
    is_complete = $6,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: PromoteTeamMember :one
UPDATE team_memberships
SET role = $3
WHERE team_id = $1 AND user_id = $2
RETURNING *;

-- name: RemoveTeamMember :exec
DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2;

-- name: DeleteTeam :exec
DELETE FROM teams WHERE id = $1;
