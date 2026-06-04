ALTER TABLE users
  ADD COLUMN user_intent TEXT NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN resume_visibility TEXT NOT NULL DEFAULT 'PRIVATE'
    CHECK (resume_visibility IN ('PRIVATE', 'TEAM_LEADS', 'PROJECT_OWNERS', 'PROJECT_OWNERS_AND_PROFESSORS', 'PUBLIC')),
  ADD COLUMN discord TEXT,
  ADD COLUMN availability_note TEXT,
  ADD COLUMN preferred_project_areas TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deactivated_at TIMESTAMPTZ,
  ADD COLUMN archived_at TIMESTAMPTZ;

ALTER TABLE teams
  ADD COLUMN recruiting_state TEXT NOT NULL DEFAULT 'RECRUITING'
    CHECK (recruiting_state IN ('RECRUITING', 'PAUSED', 'FULL', 'HIDDEN')),
  ADD COLUMN capstone_state TEXT NOT NULL DEFAULT 'FORMING'
    CHECK (capstone_state IN ('FORMING', 'APPLYING', 'OFFER_RECEIVED', 'MATCHED', 'CLOSED')),
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'VISIBLE'
    CHECK (visibility IN ('VISIBLE', 'HIDDEN')),
  ADD COLUMN discord_link TEXT,
  ADD COLUMN existing_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN needed_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN project_interests TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN archived_at TIMESTAMPTZ;

ALTER TABLE projects
  DROP CONSTRAINT projects_status_check,
  ADD COLUMN summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (lifecycle_state IN ('DRAFT', 'OPEN', 'REVIEWING', 'OFFER_SENT', 'MATCHED', 'CLOSED', 'ARCHIVED')),
  ADD COLUMN approval_state TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (approval_state IN ('UNVERIFIED', 'SUBMITTED_FOR_APPROVAL', 'PROFESSOR_APPROVED', 'CHANGES_REQUESTED')),
  ADD COLUMN required_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN nice_to_have_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN deliverables TEXT,
  ADD COLUMN timeline TEXT,
  ADD COLUMN evaluation_criteria TEXT,
  ADD COLUMN external_resources TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN owner_contact_preference TEXT,
  ADD COLUMN application_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN archived_at TIMESTAMPTZ;

UPDATE projects
SET lifecycle_state = CASE status
  WHEN 'CLAIMED' THEN 'MATCHED'
  WHEN 'IN_REVIEW' THEN 'REVIEWING'
  ELSE status
END,
summary = CASE WHEN summary = '' THEN left(description, 220) ELSE summary END;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check CHECK (status IN ('OPEN', 'IN_REVIEW', 'CLAIMED', 'CLOSED'));

ALTER TABLE project_applications
  DROP CONSTRAINT project_applications_status_check,
  ADD COLUMN applicant_id UUID REFERENCES users(id),
  ADD COLUMN answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN review_message TEXT,
  ADD COLUMN offer_message TEXT,
  ADD COLUMN team_confirmed_at TIMESTAMPTZ,
  ADD COLUMN owner_confirmed_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN withdrawn_at TIMESTAMPTZ;

UPDATE project_applications pa
SET applicant_id = tm.user_id
FROM team_memberships tm
WHERE tm.team_id = pa.team_id
  AND tm.role = 'LEAD'
  AND pa.applicant_id IS NULL;

UPDATE project_applications
SET status = CASE status
  WHEN 'PENDING' THEN 'PENDING'
  WHEN 'ACCEPTED' THEN 'ACCEPTED'
  ELSE status
END;

ALTER TABLE project_applications
  ADD CONSTRAINT project_applications_status_check
  CHECK (status IN ('PENDING', 'ACCEPTED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MESSAGE_SENT', 'OFFER_SENT', 'TEAM_CONFIRMED', 'OWNER_CONFIRMED', 'MATCHED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'));

ALTER TABLE team_join_requests
  DROP CONSTRAINT team_join_requests_status_check,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN responded_at TIMESTAMPTZ,
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN withdrawn_at TIMESTAMPTZ;

ALTER TABLE team_join_requests
  ADD CONSTRAINT team_join_requests_status_check
  CHECK (status IN ('PENDING', 'ACCEPTED', 'ACCEPTED_PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'));

CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, invited_user_id)
);

CREATE TABLE universal_deadlines (
  id TEXT PRIMARY KEY DEFAULT 'capstone_match',
  deadline_at TIMESTAMPTZ NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 'capstone_match')
);

INSERT INTO universal_deadlines (id, deadline_at)
VALUES ('capstone_match', '2026-06-20T23:59:59Z')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id UUID,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_active ON users (deactivated_at, archived_at);
CREATE INDEX idx_teams_lifecycle ON teams (recruiting_state, capstone_state);
CREATE INDEX idx_teams_archived ON teams (archived_at);
CREATE INDEX idx_projects_lifecycle ON projects (lifecycle_state, approval_state);
CREATE INDEX idx_projects_archived ON projects (archived_at);
CREATE INDEX idx_team_invitations_user_status ON team_invitations (invited_user_id, status, expires_at);
CREATE INDEX idx_team_invitations_team_status ON team_invitations (team_id, status);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);
