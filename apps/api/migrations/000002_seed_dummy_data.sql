INSERT INTO users (id, auth_user_id, username, email, full_name, discipline, university, bio) VALUES
  ('00000000-0000-0000-0000-000000000001', 'neon_user_alexng', 'alexng', 'alex@example.com', 'Alex Nguyen', 'SOEN', 'Concordia', 'Software lead interested in capstone matching.'),
  ('00000000-0000-0000-0000-000000000002', 'neon_user_mariak', 'mariak', 'maria@example.com', 'Maria Khan', 'MECH', 'Concordia', 'Mechanical designer focused on controls and CAD.'),
  ('00000000-0000-0000-0000-000000000003', 'neon_user_jordanp', 'jordanp', 'jordan@example.com', 'Jordan Patel', 'ELEC', 'Concordia', 'Stakeholder and power systems mentor.');

INSERT INTO tags (id, name, is_predefined) VALUES
  ('10000000-0000-0000-0000-000000000001', 'React', true),
  ('10000000-0000-0000-0000-000000000002', 'Go', true),
  ('10000000-0000-0000-0000-000000000003', 'CAD', true);

INSERT INTO user_tags (user_id, tag_id) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002');

INSERT INTO teams (id, name, description, is_complete, max_size, discipline, created_by) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AeroForge', 'Cross-disciplinary autonomous systems team.', false, 12, NULL, '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'GridPulse', 'Power systems and analytics capstone.', true, 10, 'ELEC', '00000000-0000-0000-0000-000000000003');

INSERT INTO team_memberships (team_id, user_id, role, joined_at) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'LEAD', '2026-05-10T00:00:00Z'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'MEMBER', '2026-05-12T00:00:00Z'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'LEAD', '2026-05-08T00:00:00Z');

INSERT INTO projects (id, title, description, disciplines, team_size_min, team_size_max, status, owner_id, team_id) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Smart Ventilation Optimizer', 'Design and validate a control loop for energy-efficient building ventilation.', ARRAY['SOEN', 'MECH'], 10, 12, 'OPEN', '00000000-0000-0000-0000-000000000003', NULL),
  ('30000000-0000-0000-0000-000000000002', 'Grid Fault Predictor', 'Predict faults from telemetry streams and provide alert confidence levels.', ARRAY['ELEC', 'SOEN'], 8, 10, 'CLAIMED', '00000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002');

UPDATE teams
SET project_id = '30000000-0000-0000-0000-000000000002'
WHERE id = '20000000-0000-0000-0000-000000000002';

INSERT INTO project_applications (id, project_id, team_id, message, status) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'We have controls and software coverage.', 'PENDING');

INSERT INTO messages (id, sender_id, receiver_id, body, read, created_at) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Can we discuss project constraints?', true, '2026-05-20T00:00:00Z'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Yes, let''s sync tomorrow at 2pm.', false, '2026-05-21T00:00:00Z');

INSERT INTO notifications (id, user_id, type, payload, read, created_at) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'APPLICATION', '{"projectId":"30000000-0000-0000-0000-000000000001"}', false, '2026-05-21T00:00:00Z'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'MESSAGE', '{"fromUserId":"00000000-0000-0000-0000-000000000003"}', true, '2026-05-22T00:00:00Z');

INSERT INTO admin_users (user_id) VALUES ('00000000-0000-0000-0000-000000000001');
