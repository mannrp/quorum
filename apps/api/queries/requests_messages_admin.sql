-- name: CreateJoinRequest :one
INSERT INTO team_join_requests (team_id, user_id, message, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetJoinRequestForUserTeam :one
SELECT *
FROM team_join_requests
WHERE team_id = $1
  AND user_id = $2
ORDER BY created_at DESC
LIMIT 1;

-- name: RespondToJoinRequest :one
UPDATE team_join_requests
SET status = $2,
    responded_at = now(),
    expires_at = CASE WHEN $2 = 'ACCEPTED_PENDING_CONFIRMATION' THEN $3 ELSE expires_at END
WHERE id = $1
  AND status = 'PENDING'
RETURNING *;

-- name: ConfirmJoinRequest :one
UPDATE team_join_requests
SET status = 'CONFIRMED',
    confirmed_at = now()
WHERE id = $1
  AND status = 'ACCEPTED_PENDING_CONFIRMATION'
RETURNING *;

-- name: GetJoinRequest :one
SELECT *
FROM team_join_requests
WHERE id = $1;

-- name: ListJoinRequestsForTeam :many
SELECT *
FROM team_join_requests
WHERE team_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY created_at DESC
LIMIT 50;

-- name: ListJoinRequestsForUser :many
SELECT *
FROM team_join_requests
WHERE user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY created_at DESC
LIMIT 50;

-- name: CreateTeamInvitation :one
INSERT INTO team_invitations (team_id, invited_user_id, invited_by, message, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetTeamInvitationForUserTeam :one
SELECT *
FROM team_invitations
WHERE team_id = $1
  AND invited_user_id = $2
ORDER BY created_at DESC
LIMIT 1;

-- name: GetTeamInvitation :one
SELECT *
FROM team_invitations
WHERE id = $1;

-- name: ListTeamInvitationsForUser :many
SELECT *
FROM team_invitations
WHERE invited_user_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- name: ListTeamInvitationsForTeam :many
SELECT *
FROM team_invitations
WHERE team_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- name: RespondToTeamInvitation :one
UPDATE team_invitations
SET status = $2,
    responded_at = now()
WHERE id = $1
  AND status = 'PENDING'
RETURNING *;

-- name: SendMessage :one
INSERT INTO messages (sender_id, receiver_id, body)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetMessage :one
SELECT *
FROM messages
WHERE id = $1;

-- name: ListMessagesWithUser :many
SELECT *
FROM messages
WHERE (sender_id = $1 AND receiver_id = $2)
   OR (sender_id = $2 AND receiver_id = $1)
ORDER BY created_at;

-- name: ListInboxUsers :many
SELECT DISTINCT u.*
FROM users u
JOIN messages m ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
WHERE m.sender_id = $1 OR m.receiver_id = $1
ORDER BY u.full_name
LIMIT 50;

-- name: MarkMessageRead :one
UPDATE messages
SET read = true
WHERE id = $1 AND receiver_id = $2
RETURNING *;

-- name: CountUnreadMessages :one
SELECT count(*)::int
FROM messages
WHERE receiver_id = $1 AND read = false;

-- name: ListNotifications :many
SELECT *
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- name: GetNotification :one
SELECT *
FROM notifications
WHERE id = $1;

-- name: MarkNotificationRead :one
UPDATE notifications
SET read = true
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: WithdrawOtherJoinRequests :exec
UPDATE team_join_requests
SET status = 'WITHDRAWN',
    withdrawn_at = now()
WHERE user_id = $1
  AND id <> $2
  AND status IN ('PENDING', 'ACCEPTED_PENDING_CONFIRMATION');

-- name: ExpireJoinRequest :one
UPDATE team_join_requests
SET status = 'EXPIRED',
    withdrawn_at = now()
WHERE id = $1
  AND status IN ('PENDING', 'ACCEPTED_PENDING_CONFIRMATION')
RETURNING *;

-- name: ExpireDueJoinRequests :exec
UPDATE team_join_requests
SET status = 'EXPIRED',
    withdrawn_at = now()
WHERE status = 'ACCEPTED_PENDING_CONFIRMATION'
  AND expires_at IS NOT NULL
  AND expires_at <= $1;

-- name: ExpireOtherTeamInvitations :exec
UPDATE team_invitations
SET status = 'EXPIRED',
    responded_at = now()
WHERE invited_user_id = $1
  AND id <> $2
  AND status = 'PENDING';

-- name: ExpireTeamInvitation :one
UPDATE team_invitations
SET status = 'EXPIRED',
    responded_at = now()
WHERE id = $1
  AND status = 'PENDING'
RETURNING *;

-- name: ExpireDueTeamInvitations :exec
UPDATE team_invitations
SET status = 'EXPIRED',
    responded_at = now()
WHERE status = 'PENDING'
  AND expires_at <= $1;

-- name: CreateNotification :one
INSERT INTO notifications (user_id, type, payload)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CountUnreadNotifications :one
SELECT count(*)::int
FROM notifications
WHERE user_id = $1 AND read = false;

-- name: IsAdmin :one
SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = $1);

-- name: ListAdminUsers :many
SELECT u.*
FROM users u
JOIN admin_users au ON au.user_id = u.id
ORDER BY au.granted_at DESC;

-- name: GetUniversalDeadline :one
SELECT *
FROM universal_deadlines
WHERE id = 'capstone_match';

-- name: UpsertUniversalDeadline :one
INSERT INTO universal_deadlines (id, deadline_at, updated_by)
VALUES ('capstone_match', $1, $2)
ON CONFLICT (id) DO UPDATE
SET deadline_at = EXCLUDED.deadline_at,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
RETURNING *;

-- name: CreateAuditLog :one
INSERT INTO audit_logs (
  actor_user_id, action_type, target_entity_type, target_entity_id,
  previous_value, new_value, reason, metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListAuditLogs :many
SELECT *
FROM audit_logs
ORDER BY created_at DESC
LIMIT $1;
