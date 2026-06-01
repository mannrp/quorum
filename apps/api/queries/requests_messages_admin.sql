-- name: CreateJoinRequest :one
INSERT INTO team_join_requests (team_id, user_id, message)
VALUES ($1, $2, $3)
RETURNING *;

-- name: RespondToJoinRequest :one
UPDATE team_join_requests
SET status = $2
WHERE id = $1
RETURNING *;

-- name: GetJoinRequest :one
SELECT *
FROM team_join_requests
WHERE id = $1;

-- name: ListJoinRequestsForTeam :many
SELECT tjr.*, u.username, u.full_name
FROM team_join_requests tjr
JOIN users u ON u.id = tjr.user_id
WHERE tjr.team_id = $1
ORDER BY tjr.created_at DESC;

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
ORDER BY u.full_name;

-- name: MarkMessageRead :one
UPDATE messages
SET read = true
WHERE id = $1
RETURNING *;

-- name: ListNotifications :many
SELECT *
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetNotification :one
SELECT *
FROM notifications
WHERE id = $1;

-- name: MarkNotificationRead :one
UPDATE notifications
SET read = true
WHERE id = $1
RETURNING *;

-- name: IsAdmin :one
SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = $1);

-- name: ListAdminUsers :many
SELECT u.*
FROM users u
JOIN admin_users au ON au.user_id = u.id
ORDER BY au.granted_at DESC;
