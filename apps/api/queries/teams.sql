-- name: GetTeam :one
SELECT * FROM teams WHERE id = $1;

-- name: ListTeams :many
SELECT *
FROM teams
WHERE (sqlc.narg('discipline')::text IS NULL OR discipline = sqlc.narg('discipline')::text)
  AND archived_at IS NULL
  AND visibility = 'VISIBLE'
  AND (sqlc.narg('has_project')::boolean IS NULL OR (project_id IS NOT NULL) = sqlc.narg('has_project')::boolean)
  AND (sqlc.narg('is_complete')::boolean IS NULL OR is_complete = sqlc.narg('is_complete')::boolean)
  AND (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY created_at DESC
LIMIT 50;

-- name: ListTeamsForUser :many
SELECT DISTINCT t.*
FROM teams t
JOIN team_memberships tm ON tm.team_id = t.id
WHERE tm.user_id = $1
  AND t.archived_at IS NULL
ORDER BY t.created_at DESC
LIMIT 50;

-- name: ListTeamMembers :many
SELECT tm.*, u.username, u.full_name, u.discipline, u.university
FROM team_memberships tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1
ORDER BY tm.joined_at;

-- name: CountTeamMembers :one
SELECT count(*)::int
FROM team_memberships
WHERE team_id = $1;

-- name: CountUserTeams :one
SELECT count(*)::int
FROM team_memberships tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = $1
  AND t.archived_at IS NULL;

-- name: CreateTeam :one
INSERT INTO teams (
  name, description, discipline, max_size, created_by, recruiting_state,
  capstone_state, visibility, discord_link, existing_skills, needed_skills, project_interests
)
VALUES ($1, $2, $3, $4, $5, $6, 'FORMING', $7, $8, $9, $10, $11)
RETURNING *;

-- name: AddTeamMember :one
INSERT INTO team_memberships (team_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetTeamMembership :one
SELECT *
FROM team_memberships
WHERE team_id = $1
  AND user_id = $2;

-- name: UpdateTeam :one
UPDATE teams
SET name = $2,
    description = $3,
    discipline = $4,
    max_size = $5,
    is_complete = $6,
    recruiting_state = $7,
    visibility = $8,
    discord_link = $9,
    existing_skills = $10,
    needed_skills = $11,
    project_interests = $12,
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

-- name: ArchiveTeam :exec
UPDATE teams
SET archived_at = now(),
    capstone_state = 'CLOSED',
    recruiting_state = 'HIDDEN',
    visibility = 'HIDDEN',
    updated_at = now()
WHERE id = $1;

-- name: CountTeamCoLeads :one
SELECT count(*)::int
FROM team_memberships
WHERE team_id = $1 AND role = 'CO_LEAD';
