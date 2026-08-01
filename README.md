# Quorum

Quorum is a capstone matching workspace for students, teams, project owners, and admins.

> **Auth V2 is not wired yet:** the running code still uses legacy Neon Auth. Current facts and the lean replacement plan start in [`docs/auth/README.md`](docs/auth/README.md).

Students use Quorum to build a profile around their skills, discipline, availability, links, and resume; find teammates; request to join teams; and apply to real capstone-style projects. Project owners publish opportunities, review applicants, send offers, and manage project assets. Admins review project submissions, keep the marketplace healthy, set deadlines, and audit important actions.

The product is built around the full matching workflow: profiles make students discoverable, teams make collaboration explicit, projects create demand, and applications, offers, messaging, and notifications keep the process moving.

## What You Can Do

- Create student profiles with skills, disciplines, resumes, portfolio links, and availability.
- Form teams, manage members, recruit for missing skills, request to join teams, and send invitations.
- Publish project listings with discipline fit, team-size requirements, supporting files, and application questions.
- Apply to projects as a team, review applications as a project owner, send offers, and finalize matches.
- Use dashboards, messaging, notifications, and deadline-aware workflow states to keep matching work moving.
- Review project approvals, marketplace activity, admin actions, and audit logs.
- Generate signed uploads for resumes, avatars, project files, and videos through Cloudflare R2.

## Stack

- `apps/web` - Next.js, React, Tailwind, legacy Neon Auth pending auth v2
- `apps/api` - Go, gqlgen GraphQL, Postgres, Cloudflare R2
- Root workspace - npm workspaces and Turborepo

The target uses Better Auth in Next for browser sessions, a protected private Go service for product authorization, PostgreSQL, and private R2. Browser-facing operations are migrated to typed allowlisted routes as the UI needs them; arbitrary GraphQL forwarding is removed rather than benchmarked.

## Setup

The commands in this section describe the current legacy development system. Do not add new Neon-specific auth behavior. The auth-v2 local target and migration rules are in [`docs/auth/OPERATIONS.md`](docs/auth/OPERATIONS.md).

Prerequisites:

- Node.js 22.23.1 and npm 11.11.0
- Go 1.25.12
- Postgres or Neon Postgres
- Neon Auth
- Cloudflare R2 for upload signing

Install dependencies and create local env files:

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in the copied env files with your Postgres, Neon Auth, and R2 values. See `SETUP.md` for the full variable list and service notes.

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

The web app runs at `http://localhost:3000`. The GraphQL API runs at `http://localhost:8080/graphql`, and the frontend proxies GraphQL requests through `/api/graphql`.

## Demo Mode

Quorum includes a login-free demo mode with three seeded personas: student/team lead, project owner, and admin/professor. Use it only with a separate demo database or Neon branch.

```sh
cd apps/api
go run ./cmd/demo-seed --reset
```

Set `ENABLE_DEMO_MODE=true` and `DEMO_RESET_ENABLED=true` for the API, and `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` plus `NEXT_PUBLIC_DEMO_RESET_ENABLED=true` for the web app. Then open `http://localhost:3000/demo`.

## Useful Commands

```sh
npm run build
npm run typecheck
npm run lint
go test ./...
```
