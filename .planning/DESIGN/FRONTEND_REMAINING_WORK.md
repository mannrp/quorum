# Frontend Remaining Work

# Quorum Planning Design Frontend Audit

This document tracks frontend work still required to complete the flows described in `USER_FLOWS.md`.

It is based on the current Next.js app in `apps/web`.

The frontend has working pages for many routes, but several important flows are only partially wired. In a few places, controls are visible but do not call the backend. Some pages collect data that is not submitted. There are also a couple of direct implementation bugs that should be fixed before deeper flow work continues.

---

# 1. Summary

## Frontend Status

Approximate status: 40-50% complete for the `USER_FLOWS.md` v1 frontend.

Implemented or partially implemented:

- Home page with teams/projects.
- Login/register pages.
- Onboarding page.
- Dashboard page.
- Profile view and edit pages.
- Team browse/detail/create/manage pages.
- Project browse/detail/create/edit/applications pages.
- Inbox and direct messages.
- Notifications list and mark-read.
- Admin console with account/team/project/deadline/audit tabs.

Not complete:

- Invitation accept/decline.
- Join request review loading.
- Accepted join request confirmation.
- Project offer team confirmation.
- Owner final match confirmation.
- Team application tracking page.
- Profile skills/intent/resume visibility persistence.
- Team creation metadata persistence.
- Project edit page correctness.
- Professor approval UI.
- Permission-aware navigation based on backend permissions.
- Confirmation modal consistency.
- Deadline visibility and remaining-time UX.
- Full empty/error/success states across all flows.

---

# 2. Immediate Bugs to Fix

## 2.1 [x] Project Edit Mutation Uses the Wrong Argument Name

### Current State

`apps/web/app/projects/[id]/edit/page.tsx` calls:

```graphql
updateProject(projectId: $id, input: $input)
```

The backend schema expects:

```graphql
updateProject(id: ID!, input: UpdateProjectInput!)
```

### Impact

Project edit saves will fail at runtime.

### Required Work

Change the mutation to:

```graphql
mutation UpdateProjectDetails($id: ID!, $input: UpdateProjectInput!) {
  updateProject(id: $id, input: $input) { id }
}
```

### Acceptance Criteria

- Editing a project succeeds for project owner.
- Permission error is shown for non-owner.
- Success notice appears only after a successful mutation.

---

## 2.2 [x] Project Edit File Has a Late Import

### Current State

`apps/web/app/projects/[id]/edit/page.tsx` has:

```ts
import Link from "next/link";
```

at the bottom of the file.

### Impact

This can break compilation because imports must be top-level.

### Required Work

Move `Link` import to the import block at the top.

### Acceptance Criteria

- Next build/typecheck does not fail on this file.

---

## 2.3 [x] Team Creation Collects Fields It Does Not Submit

### Current State

`apps/web/app/teams/new/page.tsx` collects:

- visibility
- discordUrl
- existingSkills
- neededSkills

But the create mutation only sends:

- name
- description
- maxSize
- discipline

### Impact

Users think they configured recruiting visibility and skills, but backend receives defaults. Team browse cards and matching signals will be incomplete.

### Required Work

Include all collected fields in `CreateTeamInput`:

```ts
input: {
  name,
  description,
  maxSize: Number(maxSize),
  discipline,
  visibility: visibility === "HIDDEN" ? "HIDDEN" : "VISIBLE",
  discordLink: discordUrl || null,
  existingSkills,
  neededSkills,
  recruitingState: "RECRUITING"
}
```

Also change UI value `PUBLIC` to backend enum `VISIBLE`, or map it carefully before submission.

### Acceptance Criteria

- New team preserves visibility, Discord link, existing skills, and needed skills.
- Hidden teams do not appear in browse/search.
- Team detail/manage pages display the saved fields.

---

## 2.4 [x] Account Settings Uses Admin-Only Remove User Mutation

### Current State

`apps/web/app/settings/account/page.tsx` calls:

```graphql
removeUser(userId: $id)
```

That mutation is admin-only.

### Impact

Normal users cannot delete/deactivate their own account from account settings.

### Required Work

Use:

```graphql
deactivateAccount(reason: String)
```

for self-service account deletion/deactivation.

### Acceptance Criteria

- Normal user can deactivate own account.
- User is logged out after success.
- Error message is clear if backend rejects the request.
- Copy says deactivate/delete consistently with product decision.

---

# 3. High Priority Flow Gaps

## 3.1 [x] Team Invitation Accept / Decline

### Current State

Dashboard displays invitations in `apps/web/app/dashboard/page.tsx`, but Accept and Decline buttons have no handlers.

### Missing Behavior

Users cannot accept or decline team invitations from the dashboard.

### Required Work

Add handlers:

```graphql
mutation RespondInvitation($invitationId: ID!, $accept: Boolean!) {
  respondToTeamInvitation(invitationId: $invitationId, accept: $accept) {
    id
    status
  }
}
```

UI behavior:

- Show expiration date and remaining time.
- Confirm before accepting.
- Confirm before declining if desired.
- Refresh dashboard context after response.
- Show accepted/declined success state.
- If accept fails because user is already on a team, show a blocker with link to current team.

### Acceptance Criteria

- Accept invitation joins the team when eligible.
- Decline invitation updates status.
- Invitation disappears or changes status after response.
- Backend errors are shown inline.

---

## 3.2 Team Join Request Review

### Current State

`apps/web/app/teams/[id]/manage/page.tsx` has UI for requests, but `requests` is set to an empty array and never loaded from the backend.

### Missing Behavior

Team leads/co-leads cannot see incoming join requests. Accept/reject handlers exist visually but have no real records to operate on.

### Backend Dependency

Needs backend GraphQL read support for team join requests.

### Required Work

After backend exposes join requests:

- Extend `TEAM_QUERY` or create `TEAM_MANAGEMENT_QUERY`.
- Load request id, message, status, createdAt, expiresAt, user profile.
- Render pending requests.
- Wire accept/reject with confirmation modal.
- Refresh after action.
- Show accepted-pending-confirmation state and expiration.

### Acceptance Criteria

- Lead/co-lead sees pending requests.
- Accept sets status to accepted-pending-confirmation.
- Reject sets status to rejected.
- Applicant receives notification.
- UI shows no pending requests when empty.

---

## 3.3 Applicant Confirm Accepted Join Request

### Current State

Backend has:

```graphql
confirmJoinRequest(requestId: ID!)
```

Frontend has no obvious place to confirm accepted requests.

### Missing Behavior

The user flow requires applicant confirmation within 72 hours or before universal deadline. Without UI, accepted join requests cannot complete membership.

### Required Work

Add accepted join requests to dashboard.

UI should show:

- Team name.
- Accepted status.
- Expiration date/time.
- Remaining time.
- Confirm membership button.
- Consequences text in modal.

Mutation:

```graphql
mutation ConfirmJoin($requestId: ID!) {
  confirmJoinRequest(requestId: $requestId) {
    id
    status
    confirmedAt
  }
}
```

### Acceptance Criteria

- Applicant can confirm accepted request.
- User joins team after confirmation.
- Other pending requests/invitations are cleared by backend.
- Dashboard updates to show new team.
- Expired requests display an expired state.

---

## 3.4 Project Offer Team Confirmation

### Current State

Backend has:

```graphql
confirmProjectOfferByTeam(applicationId: ID!)
```

Frontend does not expose team-side offer confirmation.

### Missing Behavior

Team leads/co-leads cannot accept project offers.

### Required Work

Add offer cards to dashboard and/or team manage page.

UI should show:

- Project title.
- Offer message.
- Expiration date/time.
- Remaining time.
- Confirm offer button for lead/co-lead only.
- Decline/withdraw option if supported by product decision.
- Message owner action.

Mutation:

```graphql
mutation ConfirmOfferByTeam($applicationId: ID!) {
  confirmProjectOfferByTeam(applicationId: $applicationId) {
    id
    status
    teamConfirmedAt
  }
}
```

### Acceptance Criteria

- Lead/co-lead can confirm project offer.
- Regular team member can see offer but not confirm.
- Expired offers show expired copy and no confirm action.
- Dashboard updates after confirmation.

---

## 3.5 [x] Owner Final Match Confirmation

### Current State

Backend has:

```graphql
confirmProjectOfferByOwner(applicationId: ID!)
```

Frontend project applications page can send offers and reject applications, but has no "Finalize Match" action after team confirmation.

### Missing Behavior

The v1 design chooses explicit owner final confirmation. Without this UI, applications can reach `TEAM_CONFIRMED` but not complete `MATCHED`.

### Required Work

Update `apps/web/app/projects/[id]/applications/page.tsx`.

For selected application:

- If status is `TEAM_CONFIRMED`, show `Finalize Match`.
- Use confirmation modal.
- Explain consequences: project matched, team matched, competing applications withdrawn.
- Call owner confirmation mutation.
- Refresh project/application data.

Mutation:

```graphql
mutation ConfirmOfferByOwner($applicationId: ID!) {
  confirmProjectOfferByOwner(applicationId: $applicationId) {
    id
    status
    ownerConfirmedAt
  }
}
```

### Acceptance Criteria

- Owner can finalize only after team confirmation.
- Matched status appears in project and application UI.
- Competing applications no longer show as active.

---

## 3.6 Project Application Tracking for Teams

### Current State

There is no `/applications` page. Team applications are only partially visible through project detail or owner pages.

### Missing Behavior

The flow requires teams to track applications, withdraw, message owner, confirm/decline offers.

### Required Work

Create `/applications` or add a complete section to dashboard/team manage.

View should show:

- Project title.
- Project owner.
- Application status.
- Submission date.
- Last update.
- Offer expiration.
- Actions: view, withdraw, message owner, confirm offer.

Backend may need dashboard fields for current user's team applications.

### Acceptance Criteria

- Team can see all active and historical applications.
- Lead/co-lead can withdraw active applications.
- Team can open related project and message owner.
- Offer state is clear and deadline-sensitive.

---

# 4. Profile and Onboarding Gaps

## 4.1 Onboarding Does Not Save All Required Fields

### Current State

Onboarding collects:

- full name
- username
- discipline
- university
- intent
- bio
- skills
- resume

The mutation sends:

- fullName
- bio
- discipline
- university
- resumeUrl
- empty link/avatar fields

It does not send:

- username, because backend update does not accept it.
- userIntent.
- selected skills.
- resume visibility.
- optional links.
- availability note.
- preferred project areas.

### Required Work

After backend supports skills:

- Send `userIntent`.
- Send `resumeVisibility`.
- Send selected skills.
- Add optional fields required by design if not deferred.
- Avoid setting unrelated URLs to empty strings unless user intends to clear them.

### Acceptance Criteria

- New user completes onboarding and has `profileComplete: true`.
- Skills persist and show on profile.
- Intent persists and can drive dashboard sections.
- Resume visibility persists.

---

## 4.2 Profile Settings Does Not Save Skills or Resume Visibility

### Current State

Profile settings collects skills and resume visibility, but mutation does not send them.

Also, UI uses values that do not match backend enum:

- `TEAM_LEAD_ONLY`
- `PROJECT_OWNER_ONLY`

Backend enum values are:

- `PRIVATE`
- `TEAM_LEADS`
- `PROJECT_OWNERS`
- `PROJECT_OWNERS_AND_PROFESSORS`
- `PUBLIC`

### Required Work

- Update select values to backend enum values.
- Send `resumeVisibility`.
- Send skills after backend supports them.
- Add fields for Discord, availability note, preferred project areas, avatar if needed.

### Acceptance Criteria

- Resume visibility saves without GraphQL enum errors.
- Skills update persists.
- Profile view reflects saved fields.

---

## 4.3 Registration Duplicates Onboarding and Does Not Save Skills

### Current State

Registration collects profile fields and skills, bootstraps profile, then calls `updateProfile` with only a bio and basic fields.

### Missing Behavior

Registration should create account, then route to onboarding for complete profile details, or persist all collected details correctly.

### Required Work

Recommended:

- Keep registration minimal: email/password only.
- Redirect to onboarding.
- Let onboarding collect full profile.

Alternative:

- Persist all collected registration fields, including skills, and set complete only when all required fields are present.

### Acceptance Criteria

- Registration does not create a misleading partial profile.
- User is routed to onboarding if profile is incomplete.
- Skills are not silently dropped.

---

# 5. Team Flow Gaps

## 5.1 Browse Teams Filters Are Incomplete

### Current State

Teams page supports text search only.

### Missing Filters

From design:

- Discipline.
- Recruiting state.
- Needed skills.
- Existing skills.
- Open slots.
- Capstone state.

### Required Work

Add filter UI and query variables after backend supports fields.

Use controls:

- Search input.
- Discipline select.
- Recruiting state segmented control or select.
- Skills combobox.
- Open slots toggle.

### Acceptance Criteria

- User can find recruiting teams by discipline and needed skills.
- Empty state distinguishes no teams from no search results.

---

## 5.2 Team Detail Does Not Fully Gate Request to Join

### Current State

Team detail shows "Request to Join" when the viewer is not a member.

### Missing Permission-Aware UI

It should hide or explain the action when:

- User is not logged in.
- User profile incomplete.
- User already belongs to another team.
- Team is full.
- Team is paused/hidden/closed/archived.
- Deadline has passed.
- User already requested this team.

### Required Work

Use backend-provided permission/state fields or dashboard context.

UI should:

- Show clear blocker text when important.
- Avoid displaying action if obviously impossible.
- Show pending request state after submit.

### Acceptance Criteria

- No misleading join button for full/closed teams.
- Duplicate request state is visible.
- Deadline blocker is clear.

---

## 5.3 Team Management Missing Several Actions

### Current State

Team manage supports:

- Basic edit.
- Invite search/send.
- Remove member.
- Accept/reject placeholder for join requests.

Missing or incomplete:

- Join requests loading.
- Invitations list/status.
- Promote/demote from manage page.
- Pause/resume recruiting as first-class control.
- Visibility control persistence.
- Existing/needed skills editing.
- Project applications list.
- Withdraw applications.
- Leave team.
- Archive team.
- Transfer lead or lead-leave blocker.

### Required Work

Build team manage in sections:

- Summary/settings.
- Members.
- Join requests.
- Invitations.
- Recruiting controls.
- Skills/interests.
- Project applications.
- Danger area.

### Acceptance Criteria

- Lead/co-lead can manage recruiting without visiting public team page.
- Dangerous actions use confirmation modals.
- Every saved field persists to backend.

---

# 6. Project Flow Gaps

## 6.1 Project Browse Filters Are Incomplete

### Current State

Projects page supports text search only.

### Missing Filters

From design:

- Discipline.
- Required skills.
- Project status.
- Professor approval.
- Team size.
- Owner type.
- Has files/resources.

### Required Work

Add filters and update backend query support as needed.

### Acceptance Criteria

- User can filter open projects by discipline, skill, approval state, and team size.
- Project card displays lifecycle and approval badge.

---

## 6.2 Project Create Form Missing Important Fields

### Current State

Project create collects:

- title
- summary
- description
- constraints
- team size min/max
- disciplines
- file URL
- video URL
- custom questions

Missing or not persisted:

- Required skills.
- Nice-to-have skills.
- Deliverables as separate field.
- Timeline.
- Evaluation criteria.
- External resources list.
- Owner contact preference.
- Draft vs publish.
- Actual file upload for project files.

### Required Work

Add sections for:

- Skills and fit.
- Delivery expectations.
- Resources.
- Application questions.
- Publishing controls.

### Acceptance Criteria

- Owner can save draft or publish.
- Project card/detail shows required skills and approval state.
- Custom questions are visible in application form.

---

## 6.3 Project Detail Application Form Is Too Static

### Current State

Application modal has hardcoded default answer text and does not render custom questions as individual fields.

### Missing Behavior

The design requires:

- Team selected from dropdown.
- Warnings for size/skills/unverified/multiple active applications.
- Default questions.
- Custom project questions.
- Review before submit.
- No raw IDs.

### Required Work

- Remove prefilled fake answers.
- Render default blank fields.
- Parse `project.applicationQuestions`.
- Render one field per custom question.
- Add review step or clear summary before submit.
- Show warnings from local data or backend validation.

### Acceptance Criteria

- Application answers match project questions.
- User cannot submit required blank answers.
- Warnings are visible but not blockers.
- Submit success updates application state.

---

## 6.4 Project Applications Review Needs Full Detail

### Current State

Owner applications page shows application list, team roster, message, send offer, decline.

Missing:

- Application answers.
- Custom question responses.
- Skills match.
- Team size warning.
- Status timeline.
- Offer deadline display.
- Finalize match action.
- Optional rejection message input.
- Filtering/sorting.

### Backend Dependency

Needs full application hydration.

### Required Work

Enhance selected application detail panel:

- Answers section.
- Team overview and skills.
- Fit warnings.
- Timeline.
- Message action.
- Status-specific actions.

### Acceptance Criteria

- Owner can make decision from the page without missing application data.
- Offer and rejection require confirmation.
- Team-confirmed applications can be finalized.

---

## 6.5 Professor Approval UI Missing

### Current State

Backend has approval mutations.

Frontend does not expose:

- Submit for professor approval.
- Professor/admin review queue.
- Approve/request changes action.
- Approval badge flow beyond raw status display.

### Required Work

Owner project page/edit page:

- Show approval state.
- Show "Submit for professor approval" when eligible.
- Confirmation modal.

Admin/professor:

- Add pending approvals section.
- Review project detail.
- Approve or request changes with optional reason.

Project cards/detail:

- Show professor-approved trust badge.
- Show changes requested state to owner.

### Acceptance Criteria

- Owner can submit project for approval.
- Admin/professor can approve or request changes.
- Owner receives notification.
- Project browse/detail displays approval state clearly.

---

# 7. Messaging and Notifications Gaps

## 7.1 Messaging Entry Points Are Incomplete

### Current State

Inbox works for direct message threads.

Entry points are partial:

- Application detail links to inbox with `userId`.
- Profile/team/project pages do not consistently expose message actions.

### Required Work

Add "Message" actions where design calls for them:

- Profile page.
- Team page lead/contact.
- Project owner contact.
- Application detail.

Inbox should read `?userId=` and auto-select/open composer for that user.

### Acceptance Criteria

- User can start a relevant one-to-one conversation from profile, team, project, or application context.
- Receiver gets notification.

---

## 7.2 Notifications Are Generic

### Current State

Notifications page lists backend notifications and can mark them read.

Dashboard preview maps many types to generic "Capstone workflow update."

### Missing Behavior

Design requires:

- Human-readable text.
- Timestamp.
- Read/unread state.
- Link to one relevant object.
- Unread counts in nav.

### Required Work

Until backend has computed notification text/href, add a frontend mapper by type and payload:

- `JOIN_REQUEST_CREATED` -> team manage.
- `JOIN_REQUEST_REVIEWED` -> dashboard/team page.
- `TEAM_INVITATION_CREATED` -> dashboard.
- `PROJECT_OFFER_SENT` -> applications/dashboard.
- `PROJECT_MATCH_FINALIZED` -> project/team.
- `UNIVERSAL_DEADLINE_CHANGED` -> dashboard.

### Acceptance Criteria

- Every notification shown in UI has specific text.
- Clicking notification routes to relevant page.
- Mark-read updates unread count.

---

# 8. Admin Flow Gaps

## 8.1 Admin Navigation Uses Heuristic Permission

### Current State

Admin nav is shown if:

- email includes `admin`
- or username equals `admin`

### Missing Behavior

The backend already returns `dashboardContext.isAdmin`.

### Required Work

Use `isAdmin` from dashboard context for nav visibility.

### Acceptance Criteria

- Real admins see admin nav.
- Non-admin users with "admin" in email do not see admin nav unless authorized.

---

## 8.2 Admin Copy Says Delete Instead of Deactivate/Archive

### Current State

Admin actions use remove mutations that deactivate/archive, but UI says delete and warns record cannot be restored.

### Missing Behavior

Design says:

- Admin should deactivate users.
- Admin should archive teams/projects.
- Do not hard-delete.
- Preserve historical references.

### Required Work

Update labels:

- Delete user -> Deactivate user.
- Remove team -> Archive team.
- Remove post -> Archive project.

Add optional reason input and pass `reason`.

### Acceptance Criteria

- UI language matches backend behavior.
- Confirmation modal requires or strongly encourages reason.
- Audit log shows reason.

---

## 8.3 Admin Tables Need Search, Filters, Sorting, Bulk Actions

### Current State

Admin tables are simple lists.

### Missing Behavior

Design asks for dense tables with search, filters, sorting, and bulk actions.

### Required Work

V1 minimum:

- Search per tab.
- Status filters for teams/projects.
- Sort by created/status/name.
- Keep bulk actions as should-have if time allows.

### Acceptance Criteria

- Admin can find specific records quickly.
- Admin can filter archived/deactivated/status records as backend supports them.

---

## 8.4 Universal Deadline Confirmation Needs Stronger UX

### Current State

Admin deadline form saves directly.

### Missing Behavior

Design requires confirmation modal explaining consequences.

### Required Work

Add confirmation modal before saving:

- New deadline date/time.
- Consequences for active offers/invites/join confirmations.
- Reason input.

### Acceptance Criteria

- Deadline change requires confirmation.
- Reason is sent to backend.
- Success state explains notifications were sent.

---

# 9. Global UX and State Gaps

## 9.1 Confirmation Modal Consistency

### Current State

Some flows use custom modal. Some use `window.confirm`.

Examples using `window.confirm`:

- Remove team member.
- Reject application.

### Required Work

Replace browser confirms with app `Modal` for:

- Reject application.
- Remove member.
- Leave team.
- Archive team.
- Archive project.
- Delete/deactivate account.
- Deadline changes.
- Offer send/finalize.

### Acceptance Criteria

- All final/destructive actions use consistent modal.
- Modal copy explains consequences.
- Confirm buttons are disabled while submitting.

---

## 9.2 Deadline Visibility

### Current State

Dashboard shows universal deadline date. Some offer modal text mentions 72 hours.

Missing:

- Remaining time.
- Expiration date/time on offers/invites/join confirmations.
- What happens after expiration.

### Required Work

Create a small deadline/expiration display component:

- Absolute date/time.
- Relative remaining time.
- Expired state.
- Short consequence text.

Use it for:

- Team invitations.
- Accepted join requests.
- Project offers.
- Universal deadline.

### Acceptance Criteria

- Every deadline-sensitive action shows expiration before user acts.
- Expired actions are disabled and explain why.

---

## 9.3 Permission-Aware UI

### Current State

Some pages infer permissions locally. Some show actions optimistically and rely on backend errors.

### Required Work

Use backend permission fields where available:

- `team.permissions`
- `project.permissions`
- `dashboardContext.isAdmin`

Add missing permission flags if backend needs them.

### Acceptance Criteria

- Normal users do not see admin/owner/lead actions.
- Leads/co-leads see team actions.
- Project owners see project review/edit actions.
- Important blockers explain why action is unavailable.

---

## 9.4 Loading, Empty, Error, Success States

### Current State

Most pages have basic loading/error states, but they are inconsistent.

### Required Work

For each major flow, verify:

- Loading state.
- Empty state.
- Error state.
- Success state.
- Permission state.
- Deadline/expired state.

### Acceptance Criteria

- User never sees a blank panel without explanation.
- Mutation errors remain visible after modal closes.
- Successful state changes are confirmed and reflected in data.

---

# 10. Suggested Frontend Implementation Order

1. Fix project edit mutation/import bug.
2. Fix self-account deletion to use `deactivateAccount`.
3. Submit all collected team creation fields.
4. Wire dashboard invitation accept/decline.
5. After backend exposes requests, load and review join requests in team manage.
6. Add accepted join request confirmation card to dashboard.
7. Add team-side project offer confirmation card.
8. Add owner final match action in project applications page.
9. Persist profile skills, intent, and resume visibility after backend support lands.
10. Improve project application form to render real custom questions.
11. Build team application tracking view.
12. Add professor approval owner/admin UI.
13. Replace `window.confirm` with app modals.
14. Use backend permissions for nav/actions.
15. Add filters for teams/projects/admin tables.
16. Improve notification text and deep links.

---

# 11. Frontend QA Checklist

Run through these user journeys before considering v1 complete:

## Auth and Onboarding

- New user registers.
- New user is redirected to onboarding.
- User completes required profile with at least three skills.
- Incomplete profile is blocked from team/project actions.
- Login routes complete profile to dashboard.

## Team

- User creates team with skills, visibility, Discord link.
- Another user requests to join.
- Lead sees request in manage page.
- Lead accepts request.
- Applicant confirms membership.
- Invitation can be sent, accepted, and declined.
- Member can leave team.
- Lead cannot leave without transfer/archive path.
- Lead can archive team with confirmation.

## Project

- User creates project with required skills/questions.
- Team lead applies to project.
- Owner reviews answers.
- Owner rejects with optional message.
- Owner sends offer.
- Team confirms offer.
- Owner finalizes match.
- Competing applications are withdrawn/updated in UI.

## Messaging and Notifications

- User starts message from profile/project/application.
- Receiver sees unread count.
- Notification links route to relevant object.
- Mark-read updates unread count.

## Admin

- Non-admin cannot see admin nav.
- Admin can deactivate user.
- Admin can archive team/project.
- Admin can set deadline only after confirmation.
- Audit logs show action and reason.

