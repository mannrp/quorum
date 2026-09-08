# Quorum

Quorum is a capstone matching workspace for students, teams, and project sponsors.

> **Auth V2 implementation is complete.** Release-host validation still to run is tracked in docs/auth/STATUS.md.

Students use Quorum to build a profile, find teammates, form teams, and apply to capstone projects. Sponsors publish project opportunities, review applicants, send offers, and coordinate through messaging and notifications.

The product is built around the full matching workflow: profiles make students discoverable, teams make collaboration explicit, projects create demand, and applications, offers, messaging, and notifications keep the process moving.

## What You Can Do

- Create student profiles with skills, disciplines, portfolio links, and availability.
- Form teams, manage members, recruit for missing skills, request to join teams, and send invitations.
- Publish project listings with discipline fit, team-size requirements, and application questions.
- Apply to projects as a team, review applications as a project owner, send offers, and finalize matches.
- Use dashboards, messaging, notifications, and deadline-aware workflow states to keep matching work moving.

Admin and file-management features are intentionally unavailable. They require separate product work and security acceptance before they can be enabled.

## Stack

- `apps/web` - Next.js, React, Tailwind, Better Auth
- `apps/api` - Go, gqlgen GraphQL, PostgreSQL
- Root workspace - npm workspaces and Turborepo

Better Auth in Next owns browser sessions. A private Go service owns product authorization against PostgreSQL. The browser uses same-origin typed, allowlisted operations; it cannot submit GraphQL or reach Go directly.

## Setup

Auth V2 local services, database roles, migrations, and verification commands are documented in docs/auth/OPERATIONS.md.

Prerequisites:

- Node.js 22.23.1 and npm 11.11.0
- Go 1.25.12
- Docker Desktop for local PostgreSQL and Mailpit

Install dependencies and create local env files:

```sh
npm ci
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in the copied env files with local runtime-role credentials and a matching Ed25519 assertion keypair. See docs/auth/OPERATIONS.md for service and migration rules.

Run API migrations:

```sh
npm run migrate:api
```

Start the API:

```sh
npm run dev:api
```

Start the web app in another terminal:

```sh
npm run dev:web
```

The web app runs at `http://localhost:3000`. The Go API runs privately at `http://localhost:8080` during local development; browser requests go only to same-origin Next routes.

## Useful Commands

```sh
npm run build
npm run typecheck
npm run lint
cd apps/api && go test ./...
```
