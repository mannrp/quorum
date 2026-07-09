package demo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const HeaderPersona = "X-Quorum-Demo-Persona"

var personaAuthIDs = map[string]string{
	"student": "demo_student_lead",
	"owner":   "demo_project_owner",
	"admin":   "demo_admin_professor",
}

func AuthIDForPersona(persona string) (string, bool) {
	authID, ok := personaAuthIDs[strings.ToLower(strings.TrimSpace(persona))]
	return authID, ok
}

func Seed(ctx context.Context, pool *pgxpool.Pool, reset bool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if reset {
		if err := deleteFixtures(ctx, tx); err != nil {
			return err
		}
	}
	if err := insertFixtures(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func deleteFixtures(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
),
demo_teams AS (
  SELECT id FROM teams WHERE created_by IN (SELECT id FROM demo_users)
),
demo_projects AS (
  SELECT id FROM projects WHERE owner_id IN (SELECT id FROM demo_users)
)
DELETE FROM audit_logs
WHERE actor_user_id IN (SELECT id FROM demo_users)
   OR target_entity_id IN (SELECT id FROM demo_users)
   OR target_entity_id IN (SELECT id FROM demo_teams)
   OR target_entity_id IN (SELECT id FROM demo_projects);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
),
demo_teams AS (
  SELECT id FROM teams WHERE created_by IN (SELECT id FROM demo_users)
),
demo_projects AS (
  SELECT id FROM projects WHERE owner_id IN (SELECT id FROM demo_users)
)
DELETE FROM notifications
WHERE user_id IN (SELECT id FROM demo_users);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
)
DELETE FROM messages
WHERE sender_id IN (SELECT id FROM demo_users)
   OR receiver_id IN (SELECT id FROM demo_users);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
),
demo_teams AS (
  SELECT id FROM teams WHERE created_by IN (SELECT id FROM demo_users)
),
demo_projects AS (
  SELECT id FROM projects WHERE owner_id IN (SELECT id FROM demo_users)
)
DELETE FROM project_applications
WHERE team_id IN (SELECT id FROM demo_teams)
   OR project_id IN (SELECT id FROM demo_projects)
   OR applicant_id IN (SELECT id FROM demo_users);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
),
demo_teams AS (
  SELECT id FROM teams WHERE created_by IN (SELECT id FROM demo_users)
)
DELETE FROM team_invitations
WHERE team_id IN (SELECT id FROM demo_teams)
   OR invited_user_id IN (SELECT id FROM demo_users)
   OR invited_by IN (SELECT id FROM demo_users);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
),
demo_teams AS (
  SELECT id FROM teams WHERE created_by IN (SELECT id FROM demo_users)
)
DELETE FROM team_join_requests
WHERE team_id IN (SELECT id FROM demo_teams)
   OR user_id IN (SELECT id FROM demo_users);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
)
UPDATE teams SET project_id = NULL
WHERE created_by IN (SELECT id FROM demo_users)
   OR project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM demo_users));

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
)
DELETE FROM projects
WHERE owner_id IN (SELECT id FROM demo_users);

WITH demo_users AS (
  SELECT id FROM users WHERE auth_user_id LIKE 'demo_%'
)
DELETE FROM teams
WHERE created_by IN (SELECT id FROM demo_users);

DELETE FROM users
WHERE auth_user_id LIKE 'demo_%';
`)
	return err
}

func insertFixtures(ctx context.Context, tx pgx.Tx) error {
	tagNames := []string{"React", "Go", "Postgres", "CAD", "Controls", "UX Research", "Python", "Power Systems", "Data Science", "Embedded", "Product Strategy"}
	for _, name := range tagNames {
		if _, err := tx.Exec(ctx, `INSERT INTO tags (name, is_predefined) VALUES ($1, true) ON CONFLICT (name) DO NOTHING`, name); err != nil {
			return err
		}
	}

	_, err := tx.Exec(ctx, fixtureSQL)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			return errors.New("demo fixtures already exist; run with --reset to replace them")
		}
		return fmt.Errorf("insert demo fixtures: %w", err)
	}
	return nil
}

const fixtureSQL = `
INSERT INTO users (
  id, auth_user_id, username, email, full_name, discipline, university, bio,
  linkedin_url, github_url, portfolio_url, resume_url, user_intent, resume_visibility,
  discord, availability_note, preferred_project_areas, profile_complete
) VALUES
  ('90000000-0000-0000-0000-000000000001', 'demo_student_lead', 'demo-student', 'demo.student@example.com', 'Nadia Brooks', 'SOEN', 'Concordia', 'Software team lead focused on accessible workflow tools and applied AI.', 'https://linkedin.example/demo-student', 'https://github.example/demo-student', 'https://portfolio.example/nadia', 'https://files.example/nadia-brooks-resume.pdf', 'STUDENT', 'PUBLIC', 'nadia#4210', 'Available weekday evenings and Fridays for sponsor calls.', ARRAY['AI workflow systems','Civic tech','Developer tools'], true),
  ('90000000-0000-0000-0000-000000000002', 'demo_project_owner', 'demo-owner', 'demo.owner@example.com', 'Marcus Chen', 'INDUSTRY', 'Concordia', 'Industry sponsor managing data-heavy capstone opportunities.', 'https://linkedin.example/demo-owner', NULL, 'https://lab.example/urban-systems', NULL, 'PROJECT_OWNER', 'PUBLIC', 'marcus#2084', 'Usually responds within one business day.', ARRAY['Smart buildings','Logistics','Energy analytics'], true),
  ('90000000-0000-0000-0000-000000000003', 'demo_admin_professor', 'demo-admin', 'demo.admin@example.com', 'Dr. Elaine Roy', 'FACULTY', 'Concordia', 'Capstone coordinator reviewing approvals, deadlines, and marketplace health.', 'https://linkedin.example/demo-admin', NULL, 'https://concordia.example/faculty/roy', NULL, 'ADMIN', 'PUBLIC', 'roy#1001', 'Office hours Tuesday afternoons.', ARRAY['Marketplace governance','Project review','Student success'], true),
  ('90000000-0000-0000-0000-000000000004', 'demo_teammate_sofia', 'sofia-demo', 'sofia.demo@example.com', 'Sofia Martinez', 'UX', 'Concordia', 'UX researcher prototyping interviews and accessibility evaluations.', NULL, NULL, 'https://portfolio.example/sofia', 'https://files.example/sofia-resume.pdf', 'STUDENT', 'PUBLIC', 'sofia#7331', 'Open for interview synthesis and frontend pairing.', ARRAY['Health tech','Design systems'], true),
  ('90000000-0000-0000-0000-000000000005', 'demo_teammate_omar', 'omar-demo', 'omar.demo@example.com', 'Omar Haddad', 'ELEC', 'Concordia', 'Embedded systems student interested in sensor networks and controls.', NULL, 'https://github.example/omar', NULL, 'https://files.example/omar-resume.pdf', 'STUDENT', 'PUBLIC', 'omar#5530', 'Available for lab testing on campus.', ARRAY['IoT','Controls','Robotics'], true),
  ('90000000-0000-0000-0000-000000000006', 'demo_invited_lina', 'lina-demo', 'lina.demo@example.com', 'Lina Park', 'DATA', 'Concordia', 'Data scientist looking for a team with strong product direction.', NULL, 'https://github.example/lina', 'https://portfolio.example/lina', 'https://files.example/lina-resume.pdf', 'STUDENT', 'PUBLIC', 'lina#8842', 'Can own model evaluation and dashboards.', ARRAY['Forecasting','Energy analytics'], true),
  ('90000000-0000-0000-0000-000000000007', 'demo_joiner_eli', 'eli-demo', 'eli.demo@example.com', 'Eli Morgan', 'MECH', 'Concordia', 'Mechanical designer seeking a software-heavy capstone team.', NULL, NULL, 'https://portfolio.example/eli', 'https://files.example/eli-resume.pdf', 'STUDENT', 'PUBLIC', 'eli#1180', 'Available for CAD reviews and prototype fabrication.', ARRAY['Autonomous systems','Manufacturing'], true),
  ('90000000-0000-0000-0000-000000000008', 'demo_owner_secondary', 'demo-sponsor', 'demo.sponsor@example.com', 'Priya Shah', 'INDUSTRY', 'Concordia', 'Sponsor with robotics and manufacturing project ideas.', 'https://linkedin.example/priya', NULL, 'https://lab.example/manufacturing', NULL, 'PROJECT_OWNER', 'PUBLIC', 'priya#7190', 'Prefers concise team updates.', ARRAY['Manufacturing','Robotics'], true);

INSERT INTO user_tags (user_id, tag_id)
SELECT user_id, tags.id
FROM (VALUES
  ('90000000-0000-0000-0000-000000000001'::uuid, 'React'), ('90000000-0000-0000-0000-000000000001'::uuid, 'Go'), ('90000000-0000-0000-0000-000000000001'::uuid, 'Postgres'), ('90000000-0000-0000-0000-000000000001'::uuid, 'Product Strategy'),
  ('90000000-0000-0000-0000-000000000002'::uuid, 'Data Science'), ('90000000-0000-0000-0000-000000000002'::uuid, 'Power Systems'), ('90000000-0000-0000-0000-000000000002'::uuid, 'Product Strategy'),
  ('90000000-0000-0000-0000-000000000003'::uuid, 'UX Research'), ('90000000-0000-0000-0000-000000000003'::uuid, 'Product Strategy'), ('90000000-0000-0000-0000-000000000003'::uuid, 'Data Science'),
  ('90000000-0000-0000-0000-000000000004'::uuid, 'UX Research'), ('90000000-0000-0000-0000-000000000004'::uuid, 'React'), ('90000000-0000-0000-0000-000000000004'::uuid, 'Product Strategy'),
  ('90000000-0000-0000-0000-000000000005'::uuid, 'Embedded'), ('90000000-0000-0000-0000-000000000005'::uuid, 'Controls'), ('90000000-0000-0000-0000-000000000005'::uuid, 'Python'),
  ('90000000-0000-0000-0000-000000000006'::uuid, 'Python'), ('90000000-0000-0000-0000-000000000006'::uuid, 'Data Science'), ('90000000-0000-0000-0000-000000000006'::uuid, 'Postgres'),
  ('90000000-0000-0000-0000-000000000007'::uuid, 'CAD'), ('90000000-0000-0000-0000-000000000007'::uuid, 'Controls'), ('90000000-0000-0000-0000-000000000007'::uuid, 'Embedded'),
  ('90000000-0000-0000-0000-000000000008'::uuid, 'CAD'), ('90000000-0000-0000-0000-000000000008'::uuid, 'Embedded'), ('90000000-0000-0000-0000-000000000008'::uuid, 'Product Strategy')
) AS seed(user_id, tag_name)
JOIN tags ON tags.name = seed.tag_name
ON CONFLICT DO NOTHING;

INSERT INTO admin_users (user_id) VALUES ('90000000-0000-0000-0000-000000000003');

INSERT INTO teams (
  id, name, description, is_complete, max_size, discipline, created_by, recruiting_state,
  capstone_state, visibility, discord_link, existing_skills, needed_skills, project_interests, created_at
) VALUES
  ('91000000-0000-0000-0000-000000000001', 'Signal Foundry', 'Demo student team building decision tools for operations and campus services.', false, 12, 'SOEN', '90000000-0000-0000-0000-000000000001', 'RECRUITING', 'OFFER_RECEIVED', 'VISIBLE', 'https://discord.example/signal-foundry', ARRAY['React','Go','UX Research','Embedded'], ARRAY['Data Science','Controls'], ARRAY['Smart buildings','Energy analytics','Student services'], now() - interval '15 days'),
  ('91000000-0000-0000-0000-000000000002', 'Telemetry Guild', 'Data science team seeking a product-minded frontend lead.', false, 12, 'DATA', '90000000-0000-0000-0000-000000000006', 'RECRUITING', 'FORMING', 'VISIBLE', 'https://discord.example/telemetry-guild', ARRAY['Python','Data Science','Postgres'], ARRAY['React','UX Research'], ARRAY['Forecasting','Dashboards'], now() - interval '12 days'),
  ('91000000-0000-0000-0000-000000000003', 'Circuit Works', 'Embedded systems group already matched to a controls-heavy sponsor project.', true, 12, 'ELEC', '90000000-0000-0000-0000-000000000005', 'FULL', 'MATCHED', 'VISIBLE', 'https://discord.example/circuit-works', ARRAY['Embedded','Controls','Python'], ARRAY[]::text[], ARRAY['Robotics','Manufacturing'], now() - interval '25 days');

INSERT INTO team_memberships (id, team_id, user_id, role, joined_at) VALUES
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'LEAD', now() - interval '15 days'),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', 'CO_LEAD', now() - interval '14 days'),
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', 'MEMBER', now() - interval '13 days'),
  ('92000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000006', 'LEAD', now() - interval '12 days'),
  ('92000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000007', 'LEAD', now() - interval '25 days');

INSERT INTO projects (
  id, title, summary, description, constraints, disciplines, team_size_min, team_size_max,
  status, lifecycle_state, approval_state, owner_id, team_id, required_skills, nice_to_have_skills,
  deliverables, timeline, evaluation_criteria, external_resources, owner_contact_preference,
  application_questions, file_url, video_url, created_at
) VALUES
  ('93000000-0000-0000-0000-000000000001', 'Campus Energy Command Center', 'Build a live energy analytics cockpit for campus building operators.', 'Create a dashboard that blends streaming energy data, anomaly detection, and operator annotations so facilities staff can prioritize interventions.', 'Must support CSV ingestion for the demo and preserve an audit trail of operator notes.', ARRAY['SOEN','DATA','ELEC'], 10, 12, 'IN_REVIEW', 'OFFER_SENT', 'PROFESSOR_APPROVED', '90000000-0000-0000-0000-000000000002', NULL, ARRAY['React','Go','Data Science'], ARRAY['Power Systems','UX Research'], 'Prototype dashboard, alert model, stakeholder walkthrough, and final technical report.', 'Discovery in September, prototype by November, final demo in April.', 'Teams will be evaluated on workflow clarity, model validation, and maintainability.', ARRAY['https://example.com/campus-energy-brief'], 'Message through Quorum first, then schedule sponsor reviews.', '[{"id":"motivation","label":"Why is your team a fit?"},{"id":"risk","label":"What is your riskiest assumption?"}]'::jsonb, 'https://files.example/campus-energy-brief.pdf', 'https://videos.example/campus-energy-overview.mp4', now() - interval '10 days'),
  ('93000000-0000-0000-0000-000000000002', 'Autonomous Lab Inventory Rover', 'Coordinate perception, embedded controls, and operator UX for a small indoor rover.', 'Design a proof-of-concept rover that scans lab inventory tags and flags missing equipment for technicians.', 'Prototype can use simulated navigation, but the inventory workflow must be testable end to end.', ARRAY['SOEN','ELEC','MECH'], 10, 12, 'OPEN', 'OPEN', 'SUBMITTED_FOR_APPROVAL', '90000000-0000-0000-0000-000000000008', NULL, ARRAY['Embedded','Controls','React'], ARRAY['CAD','UX Research'], 'Rover workflow simulation, embedded integration plan, inventory dashboard.', 'Hardware plan in October, integration demo in February.', 'System coherence, test coverage, and hardware feasibility.', ARRAY['https://example.com/rover-inventory'], 'Teams may contact the sponsor after approval.', '[{"id":"hardware","label":"Describe your hardware experience."}]'::jsonb, NULL, NULL, now() - interval '8 days'),
  ('93000000-0000-0000-0000-000000000003', 'Permit Queue Forecasting', 'Forecast municipal permit workload and visualize confidence bands.', 'Build forecasting tools that help analysts anticipate permit review backlogs and explain drivers to nontechnical stakeholders.', 'Use seeded historical data only; no external private data sources.', ARRAY['DATA','SOEN'], 10, 12, 'OPEN', 'DRAFT', 'UNVERIFIED', '90000000-0000-0000-0000-000000000002', NULL, ARRAY['Python','Data Science','Postgres'], ARRAY['UX Research'], 'Forecast notebook, web dashboard, model card, deployment plan.', 'Scope by September, baseline by December, final model by March.', 'Forecast quality, clarity of explanation, and product usefulness.', ARRAY['https://example.com/permit-forecasting'], 'Prefers weekly async updates.', '[]'::jsonb, NULL, NULL, now() - interval '5 days'),
  ('93000000-0000-0000-0000-000000000004', 'Adaptive Ventilation Controls', 'Matched reference project showing a completed claim flow.', 'Develop an adaptive ventilation controller with safety guardrails and operator override logging.', 'Must document safety boundaries and failure modes.', ARRAY['MECH','ELEC','SOEN'], 10, 12, 'CLAIMED', 'MATCHED', 'PROFESSOR_APPROVED', '90000000-0000-0000-0000-000000000008', '91000000-0000-0000-0000-000000000003', ARRAY['Controls','Embedded','Python'], ARRAY['React'], 'Control loop prototype and verification report.', 'Matched team proceeds through winter validation.', 'Safety, documentation, and test discipline.', ARRAY[]::text[], 'Sponsor contact is already established.', '[]'::jsonb, NULL, NULL, now() - interval '20 days');

UPDATE teams SET project_id = '93000000-0000-0000-0000-000000000004'
WHERE id = '91000000-0000-0000-0000-000000000003';

INSERT INTO project_applications (
  id, project_id, team_id, applicant_id, message, answers, status, review_message,
  offer_message, team_confirmed_at, owner_confirmed_at, expires_at, created_at
) VALUES
  ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'Signal Foundry can cover the full product slice: ingestion, dashboarding, model evaluation, and sponsor-facing usability tests.', '{"motivation":"We already have frontend, Go, embedded, and UX coverage.","risk":"Getting realistic streaming data early enough."}'::jsonb, 'OFFER_SENT', 'Strong team fit. Sponsor wants a short implementation plan before final confirmation.', 'We would like to offer Signal Foundry this project, pending team confirmation within 72 hours.', NULL, NULL, now() + interval '72 hours', now() - interval '4 days'),
  ('94000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'Signal Foundry is interested in the operator workflow and can prototype the dashboard while pairing with hardware students.', '{"hardware":"Omar has embedded systems experience; Nadia and Sofia will own software and UX."}'::jsonb, 'SUBMITTED', NULL, NULL, NULL, NULL, NULL, now() - interval '2 days'),
  ('94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000006', 'Telemetry Guild brings strong forecasting and data validation skills, and is looking for a frontend collaborator.', '{"motivation":"We can evaluate alert confidence carefully.","risk":"We need stronger UI capacity."}'::jsonb, 'UNDER_REVIEW', 'Needs clarification on UX support before offer.', NULL, NULL, NULL, NULL, now() - interval '3 days'),
  ('94000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000007', 'Circuit Works has the embedded and controls background to execute safely.', '[]'::jsonb, 'MATCHED', 'Approved after sponsor review.', 'Offer accepted and finalized.', now() - interval '12 days', now() - interval '11 days', now() - interval '8 days', now() - interval '18 days');

INSERT INTO team_invitations (id, team_id, invited_user_id, invited_by, message, status, expires_at, created_at) VALUES
  ('95000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000001', 'We need a data lead for the energy dashboard. Want to join Signal Foundry?', 'PENDING', now() + interval '48 hours', now() - interval '1 day');

INSERT INTO team_join_requests (id, team_id, user_id, message, status, expires_at, responded_at, created_at) VALUES
  ('96000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000007', 'I can help with mechanical constraints and hardware validation.', 'PENDING', now() + interval '72 hours', NULL, now() - interval '20 hours'),
  ('96000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'I can help your team with React if my current offer falls through.', 'ACCEPTED_PENDING_CONFIRMATION', now() + interval '36 hours', now() - interval '2 hours', now() - interval '1 day');

INSERT INTO messages (id, sender_id, receiver_id, body, read, created_at) VALUES
  ('97000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'Your energy dashboard application is strong. Could you clarify your data ingestion plan?', false, now() - interval '3 days'),
  ('97000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'Yes. We plan to start with CSV replay and isolate the live adapter behind a small service.', true, now() - interval '2 days'),
  ('97000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'Please update the permit forecasting project before submitting for approval.', false, now() - interval '6 hours'),
  ('97000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000003', 'The rover project is ready for professor review.', false, now() - interval '4 hours');

INSERT INTO notifications (id, user_id, type, payload, read, created_at) VALUES
  ('98000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'PROJECT_OFFER_SENT', '{"applicationId":"94000000-0000-0000-0000-000000000001","projectId":"93000000-0000-0000-0000-000000000001"}'::jsonb, false, now() - interval '2 days'),
  ('98000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'JOIN_REQUEST_ACCEPTED_PENDING_CONFIRMATION', '{"requestId":"96000000-0000-0000-0000-000000000002","teamId":"91000000-0000-0000-0000-000000000002"}'::jsonb, false, now() - interval '2 hours'),
  ('98000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'PROJECT_APPLICATION_SUBMITTED', '{"applicationId":"94000000-0000-0000-0000-000000000003","projectId":"93000000-0000-0000-0000-000000000001"}'::jsonb, false, now() - interval '3 days'),
  ('98000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 'PROJECT_APPROVAL_SUBMITTED', '{"projectId":"93000000-0000-0000-0000-000000000002"}'::jsonb, false, now() - interval '4 hours'),
  ('98000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000006', 'TEAM_INVITATION_CREATED', '{"invitationId":"95000000-0000-0000-0000-000000000001","teamId":"91000000-0000-0000-0000-000000000001"}'::jsonb, false, now() - interval '1 day');

INSERT INTO universal_deadlines (id, deadline_at, updated_by)
VALUES ('capstone_match', now() + interval '45 days', '90000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE
SET deadline_at = EXCLUDED.deadline_at,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

INSERT INTO audit_logs (
  id, actor_user_id, action_type, target_entity_type, target_entity_id,
  previous_value, new_value, reason, metadata, created_at
) VALUES
  ('99000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'PROJECT_APPLICATION_SUBMITTED', 'PROJECT_APPLICATION', '94000000-0000-0000-0000-000000000001', '{}'::jsonb, '{"status":"SUBMITTED"}'::jsonb, NULL, '{}'::jsonb, now() - interval '4 days'),
  ('99000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'PROJECT_OFFER_SENT', 'PROJECT_APPLICATION', '94000000-0000-0000-0000-000000000001', '{"status":"UNDER_REVIEW"}'::jsonb, '{"status":"OFFER_SENT"}'::jsonb, 'Strong full-stack fit.', '{}'::jsonb, now() - interval '2 days'),
  ('99000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', 'PROJECT_APPROVAL_REVIEWED', 'PROJECT', '93000000-0000-0000-0000-000000000001', '{"approvalState":"SUBMITTED_FOR_APPROVAL"}'::jsonb, '{"approvalState":"PROFESSOR_APPROVED"}'::jsonb, 'Approved for demo marketplace.', '{}'::jsonb, now() - interval '3 days');
`
