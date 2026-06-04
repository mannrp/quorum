# FRONTEND REFACTOR CHECKLIST & ARCHITECTURAL PLAN

This document tracks all frontend refactoring and development tasks for the Quorum platform. We are working strictly on the frontend within the `frontend-refactor` branch (based on `staging`). Any missing backend mutations or schemas will be simulated with structured mock data in the UI until they are ready.

---

## 1. Design System & Aesthetics (Inspired by Stitch)

Based on the **Academic Timeline Design Proposal** design system from Stitch, we are shifting from the current dark-first/inconsistent palette to a light-first institutional aesthetic.

### 🎨 Color Palette & Tokens
*   **Background**: Soft off-white/paper-like tint (`#f8f9fa` for light mode, `#0c0e17` for dark mode) to reduce eye strain.
*   **Surface / Panels**: Clean white containers (`#ffffff` for light mode, `#161a2b` for dark mode) with high contrast.
*   **Primary Accent**: Deep Indigo (`#283593`) for authority, headers, and major CTAs.
*   **Secondary Accent**: Soft Slate (`#546E7A`) for neutral buttons, subheaders, and helper labels.
*   **Borders**: Thin, warm gray borders (`1px solid #e7e5e4` or `dark:border-stone-800`). No heavy shadows.
*   **Typography**:
    *   **Noto Serif**: For academic titles, numbers, and timeline headings to feel prestigious and trustworthy.
    *   **Manrope / Inter**: For high-legibility body text, navigation elements, metadata, and tables.
*   **Shapes**: Softly geometric. Cards and primary controls use a moderate radius (`0.5rem` / `8px` or `0.75rem` / `12px`). Badges and pills use `9999px` (full round).

---

## 2. Refactor Checklist by Page/Route

### [x] Global Shell & Navigation (`apps/web/app/layout.tsx`, `apps/web/components/app-shell.tsx`)
- [x] Incorporate Google Fonts (`Noto Serif` and `Manrope`) into the main layout.
- [x] Update global navigation bar to point logged-in users to `/dashboard` instead of `/` (Home).
- [x] Implement query/mutation to check current user session (`me` query) and adjust shell buttons (`Log In`/`Join Now` vs. `Dashboard`/`Account Menu`).
- [x] Add unread counts indicator badges on both desktop and mobile navigation for `Inbox` and `Notifications`.
- [x] Polish mobile navigation layout (floating bottom bar) to support main student workflows.

### [x] Onboarding Portal (`/onboarding` - [NEW])
- [x] Create `/onboarding` route for first-time login redirection if user profile is incomplete.
- [x] Design a clean, sectioned form to input:
    - Required: Full Name, Username, Email, Academic Discipline, University, User Intent, Academic Summary/Bio.
    - Required: Minimum of three academic skills/tags (using a tags picker component).
    - Optional: LinkedIn, GitHub, Portfolio URLs, and Availability Notes.
- [x] Prevent form data loss on validation failure. Implement clear inline validation and a success page with a "Get Started" CTA.

### [x] Combined Role Dashboard (`/dashboard` - [NEW])
- [x] Create `/dashboard` route as the authenticated user landing center.
- [x] Make the dashboard role-aware (loads current user, team membership, project owner status, admin flags).
- [x] Display sections dynamically:
    - **My Profile Summary**: Brief overview with links to settings.
    - **My Team Status**: Displays recruiting state, members list, active applications, or CTA to "Create a Team" / "Browse Teams" if teamless.
    - **Received/Sent Requests**: Displays pending join requests and invitations with expiration counters.
    - **My Project Status**: Displays project metadata, application count, matching status, or CTA to "Sponsor a Project" if user has project owner intent.
    - **Deadlines Tracker**: High-priority alert banner showing universal milestones.
    - **Recent Inbox Preview**: Unread messages preview.

### [x] Teams Management & Creation (`/teams`)
- [x] **Teams List (`/teams/page.tsx`)**: Refactor filtering layout and style cards as border-layered panels using the new color scheme.
- [x] **Team Detail (`/teams/[id]/page.tsx`)**:
    - [x] Update "Request to Join" button to open a custom message modal instead of sending a hardcoded string.
    - [x] Support visual display of current openings, max size, disciplines, and associated projects.
    - [x] If user is a lead/co-lead, show "Invite Member" search overlay or CTA to manage team settings.
- [x] **Create Team (`/teams/new` - [NEW])**:
    - [x] Design form for team creation: Name, Discipline, description, max size, Discord link, visibility, existing skills, and needed skills.
- [x] **Manage Team (`/teams/[id]/manage` - [NEW])**:
    - [x] Create dashboard for leads/co-leads to edit details.
    - [x] Manage recruiting states (`RECRUITING` vs `PAUSED`).
    - [x] Roster controls: demote, promote, transfer leadership, or remove members.
    - [x] Request Review Section: Accept/Reject/Vote on join requests.
    - [x] Invitation panel to search and invite students.

### [x] Projects & Claim Applications (`/projects`)
- [x] **Projects List (`/projects/page.tsx`)**: Align styling with the new design system, showing required team sizes, disciplines, and claim statuses.
- [x] **Project Detail (`/projects/[id]/page.tsx`)**:
    - [x] Replace the raw `window.prompt` Team ID application mechanism.
    - [x] Implement an overlay modal that detects the user's team membership, checks if they are a lead/co-lead, and lets them select their team automatically.
    - [x] Render the project-owner's customized application questionnaire + default questions, saving responses to the database.
- [x] **Create Project (`/projects/new` - [NEW])**:
    - [x] Form to create a project specifying title, description, constraints, disciplines, team size requirements, nice-to-have skills, files, video link, and custom application questions.
- [x] **Edit Project (`/projects/[id]/edit` - [NEW])**:
    - [x] Form to edit project scope/requirements.
    - [x] Add a confirmation warning to notify already-applying teams if "material details" (scope, team size, etc.) are modified.
- [x] **Applications Review Console (`/projects/[id]/applications` - [NEW])**:
    - [x] Workspace for project owners to review applying teams.
    - [x] Actions: Accept/Reject (with feedback), Send Project Offer (starts 72-hour team confirmation timer).

### [x] User Settings & Profile (`/settings` - [NEW])
- [x] **Profile Settings (`/settings/profile` - [NEW])**:
    - [x] Form to edit full name, discipline, university, bio, portfolio links, social handles, and availability note.
    - [x] Toggle resume visibility options: Private, Team Leads Only, Project Owners, Public within Quorum.
- [x] **Account Settings (`/settings/account` - [NEW])**:
    - [x] Manage authentication token sessions and trigger self-account deletion with confirmation modal explaining the consequences (leaves teams, withdraws applications).

### [x] Direct Messages & Contextual Chats (`/inbox`)
- [x] Refactor `/inbox` route to automatically focus/load conversation with a specific user when visiting `/inbox?userId=X`.
- [x] Integrate "Message User" CTA buttons on profile pages, team detail cards, and application review lists.
- [x] Display clean avatars, online indicators (mocked/static), and dynamic timestamps.

### [x] Notifications System (`/notifications`)
- [x] Expand notification type text handling (handle `APPLICATION_RECEIVED`, `OFFER_SENT`, `MATCH_CONFIRMED`, `TEAM_INVITE`, `JOIN_REQUEST`).
- [x] Implement deep-linking logic on click (redirects user to the specific application, chat thread, or team page).

### [x] Admin Control Console (`/admin`)
- [x] Add explicit confirmation modals before executing destructive actions (`removeUser`, `removeTeam`, `removeProject`).
- [x] Build **Deadlines Settings** pane to configure universal capstone match deadlines.
- [x] Build **Audit Logs** viewer panel displaying important actions (archived teams, deactivations, professor overrides).

---

## 3. UI Styling & Reusable Components (`apps/web/components/ui.tsx`)

- [x] **Modal**: Reusable Modal component for confirmations, prompts, and application forms.
- [x] **Combobox / Searchable Selector**: For finding users by name/username (for team invites) or selecting tags without entering IDs.
- [x] **Section / Panel**: Update to respect the light-first theme with paper surfaces, slate headers, and subtle dividers.
- [x] **Status Badge / Tag**: Standardized styling for states like `OPEN`, `PENDING`, `CLAIMED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `OFFER_SENT`.
