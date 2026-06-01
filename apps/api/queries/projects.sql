-- name: GetProject :one
SELECT * FROM projects WHERE id = $1;

-- name: ListProjects :many
SELECT *
FROM projects
WHERE (sqlc.narg('discipline')::text IS NULL OR sqlc.narg('discipline')::text = ANY(disciplines))
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
  AND (sqlc.narg('search')::text IS NULL OR title ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY created_at DESC;

-- name: ListProjectApplications :many
SELECT pa.*, t.name AS team_name
FROM project_applications pa
JOIN teams t ON t.id = pa.team_id
WHERE pa.project_id = $1
ORDER BY pa.created_at DESC;

-- name: GetProjectApplication :one
SELECT *
FROM project_applications
WHERE id = $1;

-- name: CreateProject :one
INSERT INTO projects (title, description, constraints, disciplines, team_size_min, team_size_max, owner_id, file_url, video_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateProject :one
UPDATE projects
SET title = $2,
    description = $3,
    constraints = $4,
    disciplines = $5,
    team_size_min = $6,
    team_size_max = $7,
    status = $8,
    file_url = $9,
    video_url = $10,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ApplyToProject :one
INSERT INTO project_applications (project_id, team_id, message)
VALUES ($1, $2, $3)
RETURNING *;

-- name: RespondToApplication :one
UPDATE project_applications
SET status = $2
WHERE id = $1
RETURNING *;

-- name: AssociateProject :one
UPDATE teams
SET project_id = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ClaimProject :one
UPDATE projects
SET team_id = $2,
    status = 'CLAIMED',
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = $1;
