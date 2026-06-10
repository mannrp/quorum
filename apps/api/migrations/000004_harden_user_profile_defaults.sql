UPDATE users
SET user_intent = COALESCE(user_intent, 'STUDENT'),
    resume_visibility = COALESCE(resume_visibility, 'PRIVATE'),
    preferred_project_areas = COALESCE(preferred_project_areas, '{}'),
    profile_complete = COALESCE(profile_complete, false);

ALTER TABLE users
  ALTER COLUMN user_intent SET DEFAULT 'STUDENT',
  ALTER COLUMN user_intent SET NOT NULL,
  ALTER COLUMN resume_visibility SET DEFAULT 'PRIVATE',
  ALTER COLUMN resume_visibility SET NOT NULL,
  ALTER COLUMN preferred_project_areas SET DEFAULT '{}',
  ALTER COLUMN preferred_project_areas SET NOT NULL,
  ALTER COLUMN profile_complete SET DEFAULT false,
  ALTER COLUMN profile_complete SET NOT NULL;
