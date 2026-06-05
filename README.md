# Quorum

Quorum is a capstone/project matching platform for students, teams, project owners, and admins.

## What It Does

- Student profiles with skills, disciplines, resumes, links, and availability.
- Team creation, member management, join requests, and invitations.
- Project listings with approval workflow, applications, offers, and matching.
- Messaging, notifications, dashboard context, admin review, and audit logs.
- File upload signing for resumes, avatars, project files, and videos.

## Stack

- `apps/web` - Next.js, React, Tailwind, Neon Auth
- `apps/api` - Go, gqlgen GraphQL, Postgres, Cloudflare R2
- Root workspace - npm workspaces and Turborepo

## Setup

Prerequisites: Node.js/npm, Go, and a Postgres database.

Install dependencies:

```sh
npm install
```

Create local env files:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in Postgres, auth, and R2 values. See `SETUP.md` for the full variable list.

Run API migrations:

```sh
cd apps/api
go run ./cmd/migrate
```

## Running Locally

Start the API:

```sh
cd apps/api
go run ./cmd/server
```

The GraphQL API runs at `http://localhost:8080/graphql` by default.

Start the web app in another terminal:

```sh
npm run dev --workspace=@quorum/web
```

The web app runs at `http://localhost:3000`.

## Useful Commands

```sh
npm run build
npm run typecheck
cd apps/api
go test ./...
```
