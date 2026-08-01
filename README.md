# Quorum

Quorum is a capstone matching workspace for students, teams, project owners, and admins.

> **Auth V2 cutover is in progress.** Current capability and remaining work are tracked in docs/auth/STATUS.md.

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

- `apps/web` - Next.js, React, Tailwind, Better Auth
- `apps/api` - Go, gqlgen GraphQL, Postgres, Cloudflare R2
- Root workspace - npm workspaces and Turborepo

The target uses Better Auth in Next for browser sessions, a protected private Go service for product authorization, PostgreSQL, and private R2. Browser-facing operations are migrated to typed allowlisted routes as the UI needs them; arbitrary GraphQL forwarding is removed rather than benchmarked.

## Setup

Auth V2 local services, database roles, migrations, and verification commands are documented in docs/auth/OPERATIONS.md.

Prerequisites:

- Node.js 22.23.1 and npm 11.11.0
- Go 1.25.12
- Docker Desktop for local PostgreSQL and Mailpit
- Cloudflare R2 for upload signing

Install dependencies and create local env files:

```sh
npm install
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

The web app runs at `http://localhost:3000`. The GraphQL API runs at `http://localhost:8080/graphql`, and the frontend proxies GraphQL requests through `/api/graphql`.


## Useful Commands

```sh
npm run build
npm run typecheck
npm run lint
go test ./...
```
