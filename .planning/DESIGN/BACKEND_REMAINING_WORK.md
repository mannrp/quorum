# Backend Remaining Work

# Quorum Planning Design Backend Audit

This document tracks backend work still required to complete the flows described in `USER_FLOWS.md`.

It is based on the current Go GraphQL API, SQL queries, migrations, and resolver behavior in `apps/api`.

The backend is ahead of the frontend. Many v1 workflow primitives already exist, including join requests, team invitations, project applications, offers, match confirmation, deadlines, notifications, audit logs, and admin archive/deactivate actions. The remaining backend work is mostly about exposing missing read models, preserving complete data through resolvers, tightening validation, and completing a few product behaviors.

---

# 1. Summary

## Backend Status

Approximate status: 65-75% complete for the `USER_FLOWS.md` v1 backend foundation.

Implemented or mostly implemented:

- Authentication token verification and current-user context.
- Profile bootstrap and profile update.
- Team create/update/archive, membership, promotion, removal, leave.
- Join request create/respond/confirm.
- Team invitation create/respond.
- Project create/update/archive.
- Project approval submit/review.
- Project application submit/reject/offer/team confirm/owner confirm/withdraw.
- Offer expiration helpers.
- Universal deadline read/update.
- Notification creation and read marking.
- Admin remove/deactivate/archive mutations.
- Audit log creation and listing.
- R2-style upload signing for resume/project/avatar/video assets.

Not complete:

- Read APIs for several workflow queues.
- Full application detail hydration.
- Profile skills/tags mutation support.
- Some flow-specific validations and state consistency.
- Dedicated admin/professor override APIs beyond basic remove/archive/approval.
- Voting flow for team join requests.
- Robust account deletion/anonymization semantics.
- Better notification payload contract and deep-link metadata.

---

# 2. High Priority Backend Gaps

## 2.1 Expose Team Join Requests to the Frontend

### Current State

The SQL query exists:

- `apps/api/queries/requests_messages_admin.sql`
- `ListJoinRequestsForTeam`

The GraphQL schema has:

- `TeamJoinRequest`
- `requestJoin`
- `respondToJoinRequest`
- `confirmJoinRequest`

But there is no GraphQL field or query that lets the frontend load pending requests for a team.

The `Team` type currently exposes members, permissions, project, creator, and metadata, but not join requests.

### Missing Behavior

The team manage page cannot list real join requests. Leads and co-leads cannot review incoming requests through the API shape the frontend consumes.

### Required Work

Add one of the following:

- `Team.joinRequests(status: JoinRequestStatus): [TeamJoinRequest!]!`
- or `teamJoinRequests(teamId: ID!, status: JoinRequestStatus): [TeamJoinRequest!]!`

Recommended: add `joinRequests` to `Team` so the team manage page can hydrate all team management context with one query.

### Permission Rules

Only these actors should see join request details:

- Team lead.
- Team co-leads.
- Admin/professor if admin review surfaces require it.
- The applicant, but only for their own request if a later user-facing request detail query is added.

Normal users browsing a team should not see request queues.

### Implementation Notes

- Add schema field.
- Regenerate gqlgen code.
- Add resolver that calls `ListJoinRequestsForTeam`.
- Return only pending and accepted-pending-confirmation by default, or support a `status` filter.
- Ensure request user profile is hydrated enough for review: id, username, fullName, discipline, university, bio, tags, links, resume visibility if allowed.

### Acceptance Criteria

- Team lead can load all pending join requests for their team.
- Co-lead can load all pending join requests.
- Non-member/non-lead receives a permission error or empty data according to chosen product behavior.
- Frontend can render request id, user, message, status, createdAt, expiresAt, respondedAt, confirmedAt.

---

## 2.2 Preserve Full Project Application Data in Project Resolvers

### Current State

`Project.applications` exists in GraphQL.

However, `apps/api/internal/graph/helpers.go` rebuilds application models from `ListProjectApplications` rows and currently appears to map only a subset of fields:

- id
- projectId
- teamId
- message
- status
- createdAt

Fields such as these may be dropped from the project-detail response:

- answers
- applicant
- reviewMessage
- offerMessage
- expiresAt
- teamConfirmedAt
- ownerConfirmedAt
- withdrawnAt

### Missing Behavior

The project owner review flow needs full application details:

- Application answers.
- Optional message.
- Team profile and roster.
- Offer message.
- Rejection/review message.
- Status timeline data.
- Expiration date.

Team-side application tracking also needs these fields.

### Required Work

Update application hydration so `Project.applications` maps the complete `db.ProjectApplication` row instead of constructing a partial value.

If the existing SQL row type has an extra `team_name` field, map the embedded `db.ProjectApplication` fields without discarding data.

### Permission Rules

Application details should be visible to:

- Project owner for their project.
- Team lead/co-leads/members for their own team's application.
- Admin/professor for review/override.

For public project detail pages, either hide applications entirely or expose only aggregated/sanitized data. The current schema exposes applications directly on `Project`, so the resolver must enforce visibility carefully.

### Acceptance Criteria

- Project owner can query applications with `answers`, `reviewMessage`, `offerMessage`, `expiresAt`, `teamConfirmedAt`, `ownerConfirmedAt`, `withdrawnAt`.
- Team users can query their own application status and offer deadline.
- Public users cannot inspect sensitive answers from other teams.

---

## 2.3 Add Profile Skills/Tags Mutation Support

### Current State

The UI collects skills during registration, onboarding, and profile edit.

The backend has:

- `tags`
- `user_tags`
- `ListUserTags`

But `UpdateProfileInput` has no skills/tags field.

### Missing Behavior

Selected skills are not saved by profile update flows. This breaks:

- Required onboarding condition of at least three skills.
- Profile view.
- Team and project fit signals.
- Search/filter by tag.
- Skill normalization.

### Required Work

Add a profile skill update capability.

Recommended schema options:

```graphql
input UpdateProfileInput {
  ...
  skills: [String!]
}
```

or a separate mutation:

```graphql
updateUserSkills(skills: [String!]!): User!
```

Separate mutation is cleaner if skill normalization needs its own transaction and validation.

### Data Rules

- Trim whitespace.
- Normalize case for matching while preserving display names if desired.
- Enforce minimum 3 skills when completing profile.
- Prevent excessive skill count, for example max 20.
- Create freeform tags only after normalization.
- Use existing tag rows when names match normalized names.
- Replace the user's skill set transactionally.

### Acceptance Criteria

- Onboarding can persist at least three skills.
- Profile settings can update skills.
- `me.tags` reflects the new list immediately after save.
- Search by tag works with newly added skills.

---

## 2.4 Complete Account Deletion / Deactivation Semantics

### Current State

Backend has:

- `deactivateAccount(reason: String): Boolean!`
- `removeUser(userId: ID!, reason: String): Boolean!`

`removeUser` is admin-only and deactivates a target user.

### Missing Behavior

The design says user-facing "Delete account" should likely deactivate/anonymize rather than hard-delete, preserve historical references, and log the user out.

The backend needs a clear self-service deletion contract that handles related state consistently.

### Required Work

Review and harden `deactivateAccount`.

It should:

- Require active authenticated user.
- Mark user deactivated.
- Optionally anonymize profile fields that should no longer be visible.
- Preserve historical application/team/message references.
- Withdraw pending applications where appropriate.
- Remove user from active team membership if product requires it.
- Expire pending team invitations and join requests.
- Create audit log.
- Notify affected team leads/project owners if active workflows are affected.

### Acceptance Criteria

- Normal user can deactivate their own account without admin permission.
- Deactivated user cannot perform authenticated actions.
- Profile is hidden or sanitized according to product rules.
- Historical records remain referentially intact.
- Audit log records self-deactivation.

---

## 2.5 Tighten Project Application Visibility and Ownership Checks

### Current State

Project application mutations enforce owner/team lead permissions in many places.

The read side is less clear because `Project.applications` is nested under `Project`, and public project browsing currently queries applications.

### Missing Behavior

The design expects application counts on public cards "if visible", but application answers and details should only appear in owner/team/admin contexts.

### Required Work

Decide and enforce one of these models:

1. Public `Project.applications` returns only sanitized application shells.
2. Public `Project.applications` returns an empty list unless viewer is project owner/admin/applicant team.
3. Split schema into `applicationCount` and `projectApplications(projectId)` for privileged detail.

Recommended: split public count from privileged detail.

### Acceptance Criteria

- Public project browse can show application count without leaking team answers.
- Project owner can review full applications.
- Applicant team can see its own application.
- Other teams cannot read competitor application answers.

---

# 3. Medium Priority Backend Gaps

## 3.1 Add Team Invitation and Join Request Queue Queries for Dashboard

### Current State

`myTeamInvitations` exists.

There is no equivalent dashboard query for:

- My pending join requests.
- My accepted join requests awaiting confirmation.
- My project applications as a team member/lead.
- My project offers as a team member/lead.

### Missing Behavior

The dashboard cannot reliably show:

- "Your request was accepted, confirm within 72 hours."
- "You have active join requests."
- "Your team received an offer."
- "Your team has submitted applications."

### Required Work

Add dashboard-oriented fields:

```graphql
type DashboardContext {
  myTeams: [Team!]!
  myProjects: [Project!]!
  myInvitations: [TeamInvitation!]!
  myJoinRequests: [TeamJoinRequest!]!
  myTeamApplications: [ProjectApplication!]!
  myProjectOffers: [ProjectApplication!]!
  ...
}
```

Alternatively, expose separate queries.

### Acceptance Criteria

- Dashboard can render all deadline-sensitive user tasks from backend data.
- Dashboard does not need to infer task state by scanning unrelated public lists.

---

## 3.2 Complete Team Management Read Model

### Current State

Team manage needs one complete backend payload.

Current `Team` includes:

- Summary.
- Members.
- Permissions.
- Project.

Missing:

- Join requests.
- Invitations.
- Applications for the team.
- Recruiting/deadline status.

### Required Work

Add a dedicated `TeamManagementContext` query, or expand `Team` with permission-gated fields.

Example:

```graphql
teamManagementContext(teamId: ID!): TeamManagementContext!
```

Fields:

- team
- joinRequests
- invitations
- applications
- universalDeadline
- canManage

### Acceptance Criteria

- Team manage page loads with one query.
- Unauthorized users cannot load management data.
- Pending invitations and requests are visible to leads/co-leads.

---

## 3.3 Project Owner Review Context

### Current State

Project applications are nested on `Project`, but not enough for a full review workflow.

### Required Work

Add:

```graphql
projectReviewContext(projectId: ID!): ProjectReviewContext!
```

Fields:

- project
- applications
- universalDeadline
- permissions
- audit/status timeline if implemented

### Acceptance Criteria

- Owner review page can render list and detail panels without leaking data.
- The application detail contains answer payload, offer deadline, review message, team roster, team skills.

---

## 3.4 Application Timeline / History

### Current State

Audit logs exist globally, and application status timestamps exist.

### Missing Behavior

`USER_FLOWS.md` lists application history timeline as should-have. The current model can approximate timeline from fields, but it is not exposed as a timeline.

### Required Work

Either:

- Add computed `timeline` field to `ProjectApplication`.
- Or expose filtered audit logs by target.

Example:

```graphql
applicationTimeline(applicationId: ID!): [TimelineEvent!]!
```

### Acceptance Criteria

- Owner and team can see submitted, offer sent, team confirmed, matched, withdrawn, expired timestamps.
- Admin can inspect exceptional status changes.

---

## 3.5 Material Project Edit Notification Rules

### Current State

Project update notifies all applicants with `PROJECT_EDITED`.

### Missing Behavior

The design says material edits should trigger a confirmation and notify applicants. Backend currently appears to notify on any project update, not only material changes.

### Required Work

Define material fields:

- description
- constraints
- disciplines
- team size min/max
- required skills
- deliverables
- timeline
- evaluation criteria
- application questions

Backend can either:

- Always notify and let frontend confirm.
- Or compare before/after and notify only when material fields changed.

Recommended: backend should compare and notify only on material changes, while frontend still confirms before saving those changes.

### Acceptance Criteria

- Cosmetic updates do not spam applicants.
- Material updates notify affected teams.
- Audit log records before/after state.

---

## 3.6 Notification Payload Contract

### Current State

Notifications store:

- type
- payload JSON string
- read
- createdAt

Payloads are ad hoc maps.

### Missing Behavior

The frontend needs human-readable text and one relevant link per notification. Currently it must infer these from type/payload.

### Required Work

Define a stable notification payload contract:

```json
{
  "title": "...",
  "body": "...",
  "href": "/projects/...",
  "entityType": "PROJECT_APPLICATION",
  "entityId": "..."
}
```

Alternative: keep payload minimal but add computed GraphQL fields:

- title
- body
- href

### Acceptance Criteria

- Every notification has a deterministic route.
- Frontend can render specific useful text without a large local switch statement.
- Mark-read remains scoped to the current user.

---

# 4. Lower Priority / Deferred Backend Gaps

## 4.1 Join Request Voting

Direct approval exists. Voting does not.

Design says voting can defer if direct approval needs to ship first. If implemented:

- Add `team_join_request_votes`.
- Add `startJoinRequestVote`.
- Add `voteOnJoinRequest`.
- Define majority/tie rules.
- Notify applicant after final decision.

## 4.2 Admin Bulk Actions

Current admin remove/archive actions are per-record.

Bulk actions should remain deferred until single-record admin UX is correct.

## 4.3 User Impersonation

Listed as can-defer. No backend work needed for v1 unless support workflows require it.

## 4.4 Recommendation Scoring

Advanced recommendation scoring is deferred. Current search/filter can be enough.

---

# 5. Validation and Permission Checklist

Use this checklist while finishing backend work.

## Authentication

- Every mutation requires an authenticated user.
- Mutations that change student/team/project workflows require active user.
- Mutations that perform student actions require complete profile.
- Deactivated users cannot act.

## Team Rules

- User cannot create a team if already on an active team.
- User cannot request to join a team if already on an active team.
- User cannot accept an invitation if already on an active team.
- Team must be recruiting and not full for requests/invitations.
- Lead/co-lead can review requests.
- Lead-only actions remain lead-only where specified.
- Lead leaving rules are enforced.

## Project Rules

- User can own only one project in v1.
- Team lead/co-lead only can apply.
- Project must be open/reviewing for applications.
- Team cannot submit duplicate active applications to the same project.
- Offers expire after 72 hours or universal deadline, whichever is sooner.
- Final match withdraws competing team/project applications.

## Admin Rules

- Admin console queries and mutations require admin status from `admin_users`.
- Admin actions create audit logs.
- Admin archive/deactivate actions notify affected users.
- Universal deadline changes create audit logs and notifications.

---

# 6. Suggested Backend Implementation Order

1. Expose join requests in GraphQL and wire permission checks.
2. Fix full project application hydration and visibility rules.
3. Add profile skills/tags update support.
4. Add dashboard fields for pending join confirmations, team applications, and offers.
5. Harden account self-deactivation.
6. Add dedicated team management and project review context queries.
7. Stabilize notification payloads/deep links.
8. Refine material project edit notifications.
9. Add application timeline/history if time allows.
10. Defer join-request voting and admin bulk actions unless explicitly pulled into v1.

---

# 7. Backend Test Coverage Needed

Add or expand tests for:

- Non-lead cannot list/respond to team join requests.
- Lead/co-lead can list/respond to team join requests.
- Applicant can confirm accepted join request before expiration.
- Accepted join request expires after 72 hours or universal deadline.
- Invitation accept joins team and expires competing invitations/requests.
- Project owner can see full application details.
- Public user cannot see sensitive application answers.
- Team lead/co-lead can confirm offer.
- Project owner can finalize match after team confirmation.
- Final match withdraws competing applications.
- Universal deadline blocks deadline-sensitive actions.
- Profile skill update creates/reuses normalized tags.
- Self-deactivation preserves historical references and blocks future actions.
- Admin actions create audit logs.

