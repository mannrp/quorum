CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_teams_name_trgm
  ON teams USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_title_trgm
  ON projects USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_memberships_team_joined
  ON team_memberships (team_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_team_memberships_user_role
  ON team_memberships (user_id, role);

CREATE INDEX IF NOT EXISTS idx_user_tags_user
  ON user_tags (user_id);

CREATE INDEX IF NOT EXISTS idx_project_applications_project_created
  ON project_applications (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_applications_team_status
  ON project_applications (team_id, status);

CREATE INDEX IF NOT EXISTS idx_team_join_requests_user_status
  ON team_join_requests (user_id, status, expires_at);
