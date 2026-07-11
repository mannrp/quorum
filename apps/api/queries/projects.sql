-- name: GetProject :one
SELECT * FROM projects WHERE id = $1;

-- name: ListProjects :many
SELECT *
FROM projects
WHERE (sqlc.narg('discipline')::text IS NULL OR sqlc.narg('discipline')::text = ANY(disciplines))
  AND archived_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR lifecycle_state = sqlc.narg('status')::text OR status = sqlc.narg('status')::text)
  AND (sqlc.narg('search')::text IS NULL OR title ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY created_at DESC
LIMIT 50;

-- name: ListProjectsForOwner :many
SELECT *
FROM projects
WHERE owner_id = $1
  AND archived_at IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- name: ListProjectApplications :many
SELECT *
FROM project_applications
WHERE project_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- name: GetProjectApplication :one
SELECT *
FROM project_applications
WHERE id = $1;

-- name: CreateProject :one
INSERT INTO projects (
  title, summary, description, constraints, disciplines, team_size_min, team_size_max,
  owner_id, file_url, video_url, lifecycle_state, approval_state, required_skills,
  nice_to_have_skills, deliverables, timeline, evaluation_criteria, external_resources,
  owner_contact_preference, application_questions
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
RETURNING *;

-- name: UpdateProject :one
UPDATE projects
SET title = $2,
    summary = $3,
    description = $4,
    constraints = $5,
    disciplines = $6,
    team_size_min = $7,
    team_size_max = $8,
    lifecycle_state = $9,
    status = CASE $9
      WHEN 'REVIEWING' THEN 'IN_REVIEW'
      WHEN 'MATCHED' THEN 'CLAIMED'
      WHEN 'CLOSED' THEN 'CLOSED'
      ELSE 'OPEN'
    END,
    file_url = $10,
    video_url = $11,
    approval_state = $12,
    required_skills = $13,
    nice_to_have_skills = $14,
    deliverables = $15,
    timeline = $16,
    evaluation_criteria = $17,
    external_resources = $18,
    owner_contact_preference = $19,
    application_questions = $20,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ApplyToProject :one
INSERT INTO project_applications (project_id, team_id, applicant_id, message, answers, status)
VALUES ($1, $2, $3, $4, $5, 'SUBMITTED')
RETURNING *;

-- name: GetProjectApplicationForTeamProject :one
SELECT *
FROM project_applications
WHERE project_id = $1
  AND team_id = $2
ORDER BY created_at DESC
LIMIT 1;

-- name: RespondToApplication :one
UPDATE project_applications
SET status = $2,
    review_message = $3
WHERE id = $1
  AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'MESSAGE_SENT', 'OFFER_SENT', 'TEAM_CONFIRMED')
RETURNING *;

-- name: SendProjectOffer :one
UPDATE project_applications
SET status = 'OFFER_SENT',
    offer_message = $2,
    expires_at = $3
WHERE id = $1
  AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'MESSAGE_SENT')
RETURNING *;

-- name: ConfirmProjectOfferByTeam :one
UPDATE project_applications
SET status = 'TEAM_CONFIRMED',
    team_confirmed_at = now()
WHERE id = $1
  AND status = 'OFFER_SENT'
RETURNING *;

-- name: ConfirmProjectOfferByOwner :one
UPDATE project_applications
SET status = 'MATCHED',
    owner_confirmed_at = now()
WHERE id = $1
  AND status = 'TEAM_CONFIRMED'
RETURNING *;

-- name: WithdrawApplication :one
UPDATE project_applications
SET status = 'WITHDRAWN',
    withdrawn_at = now()
WHERE id = $1
  AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'MESSAGE_SENT', 'OFFER_SENT', 'TEAM_CONFIRMED')
RETURNING *;

-- name: ExpireProjectOffer :one
UPDATE project_applications
SET status = 'EXPIRED',
    withdrawn_at = now()
WHERE id = $1
  AND status IN ('OFFER_SENT', 'TEAM_CONFIRMED')
RETURNING *;

-- name: ExpireDueProjectOffers :exec
UPDATE project_applications
SET status = 'EXPIRED',
    withdrawn_at = now()
WHERE status IN ('OFFER_SENT', 'TEAM_CONFIRMED')
  AND expires_at IS NOT NULL
  AND expires_at <= $1;

-- name: WithdrawCompetingTeamApplications :exec
UPDATE project_applications
SET status = 'WITHDRAWN',
    withdrawn_at = now()
WHERE team_id = $1
  AND id <> $2
  AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'MESSAGE_SENT', 'OFFER_SENT', 'TEAM_CONFIRMED');

-- name: WithdrawCompetingProjectApplications :exec
UPDATE project_applications
SET status = 'WITHDRAWN',
    withdrawn_at = now()
WHERE project_id = $1
  AND id <> $2
  AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'MESSAGE_SENT', 'OFFER_SENT', 'TEAM_CONFIRMED');

-- name: UpdateTeamCapstoneState :exec
UPDATE teams
SET capstone_state = $2,
    updated_at = now()
WHERE id = $1;

-- name: UpdateProjectLifecycleState :one
UPDATE projects
SET lifecycle_state = $2,
    status = CASE $2
      WHEN 'REVIEWING' THEN 'IN_REVIEW'
      WHEN 'MATCHED' THEN 'CLAIMED'
      WHEN 'CLOSED' THEN 'CLOSED'
      ELSE 'OPEN'
    END,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateProjectApprovalState :one
UPDATE projects
SET approval_state = $2,
    updated_at = now()
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
    lifecycle_state = 'MATCHED',
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveProject :exec
UPDATE projects
SET archived_at = now(),
    lifecycle_state = 'ARCHIVED',
    updated_at = now()
WHERE id = $1;
