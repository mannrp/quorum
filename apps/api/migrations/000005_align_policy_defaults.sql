ALTER TABLE users
  ALTER COLUMN resume_visibility SET DEFAULT 'PUBLIC';

ALTER TABLE team_memberships
  DROP CONSTRAINT IF EXISTS team_memberships_user_id_key;

WITH next_deadline AS (
  SELECT CASE
    WHEN now() < make_timestamptz(EXTRACT(YEAR FROM now())::int, 9, 15, 0, 0, 0, 'America/Toronto')
      THEN make_timestamptz(EXTRACT(YEAR FROM now())::int, 9, 15, 0, 0, 0, 'America/Toronto')
    ELSE make_timestamptz(EXTRACT(YEAR FROM now())::int + 1, 9, 15, 0, 0, 0, 'America/Toronto')
  END AS deadline_at
)
INSERT INTO universal_deadlines (id, deadline_at)
SELECT 'capstone_match', deadline_at
FROM next_deadline
ON CONFLICT (id) DO UPDATE
SET deadline_at = EXCLUDED.deadline_at,
    updated_at = now()
WHERE universal_deadlines.deadline_at = TIMESTAMPTZ '2026-06-20T23:59:59Z'
   OR universal_deadlines.deadline_at < now();
