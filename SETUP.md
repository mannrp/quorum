# Quorum Setup Notes

## Product Auth Decision

Quorum uses Neon Auth for authentication and session management. The Go backend still owns Quorum authorization and product rules: team leadership, admin checks, project claims, applications, messages, and file signing.

The local `users` table is the Quorum profile table. It stores `auth_user_id`, which maps to the user identity from Neon Auth, plus app profile fields such as username, full name, discipline, university, links, and tags.

## Accounts And Services To Create

- Neon project for Postgres.
- Neon Auth enabled for the project.
- Cloudflare R2 bucket for resumes, avatars, portfolios, project files, and videos.
- Fly.io app for the Go backend when deployment begins.
- Vercel project for the Next.js frontend when deployment begins.

Email verification is handled by Neon Auth, so Quorum does not need app-owned SMTP credentials for MVP.

## Local Env Files

Prerequisites for local development:

- Node.js 22 with npm 11.
- Go 1.25, matching `apps/api/go.mod`.
- Postgres locally or a Neon Postgres branch.
- Neon Auth values from the same Neon branch.
- Cloudflare R2 credentials for signed upload flows.

Create local env files from the committed examples:

- `apps/api/.env`
- `apps/web/.env.local`

Do not commit real env files. `.gitignore` keeps them private.

## Backend Variables

- `DATABASE_URL`: Neon Postgres connection string.
- `PORT`: local Go server port, default `8080`.
- `APP_ORIGIN`: frontend origin, usually `http://localhost:3000`.
- `ENABLE_DEMO_MODE`: enables login-free seeded persona impersonation when set to `true`. Use only with a separate demo database/Neon branch.
- `DEMO_RESET_ENABLED`: enables the demo reset HTTP endpoint when set to `true`. Requires `ENABLE_DEMO_MODE=true`.
- `NEON_AUTH_ISSUER`: token issuer from Neon Auth.
- `NEON_AUTH_JWKS_URL`: JWKS endpoint used by Go to validate auth tokens.
- `NEON_AUTH_AUDIENCE`: expected token audience if Neon Auth requires one for the configured app.
- `R2_ACCOUNT_ID`: Cloudflare account ID.
- `R2_ACCESS_KEY_ID`: Cloudflare R2 access key.
- `R2_SECRET_ACCESS_KEY`: Cloudflare R2 secret key.
- `R2_BUCKET_NAME`: R2 bucket name.
- `R2_PUBLIC_URL`: public/custom R2 URL used when generating file access URLs.
- `ADMIN_EMAILS`: comma-separated emails to bootstrap as Quorum admins.

## Frontend Variables

- `NEXT_PUBLIC_API_URL`: Go GraphQL endpoint, usually `http://localhost:8080/graphql`.
- `NEXT_PUBLIC_ENABLE_DEMO_MODE`: shows the `/demo` hub and forwards demo persona cookies through the GraphQL proxy when set to `true`.
- `NEXT_PUBLIC_DEMO_RESET_ENABLED`: shows the admin-only demo reset button when set to `true`. The API must also have `DEMO_RESET_ENABLED=true`.
- `API_URL`: optional server-side override for the GraphQL endpoint used by the Next.js proxy.
- `NEXT_PUBLIC_GRAPHQL_PROXY_URL`: optional browser-facing GraphQL proxy override. Defaults to `/api/graphql`.
- `NEON_AUTH_BASE_URL`: Neon Auth URL for the current branch. This is the Auth URL from Neon, not the Data API REST URL.
- `NEON_AUTH_COOKIE_SECRET`: at least 32 characters, used by the Next.js auth proxy to sign cached session cookies. Generate with `openssl rand -base64 32`.

The Next.js app owns browser sign-in with the official Neon Auth SDK and exposes `/api/auth/[...path]` as the auth proxy. It stores Neon session state in signed httpOnly cookies, then requests a Neon JWT and sends that token to the Go GraphQL API as a bearer token. Browser GraphQL calls go to `/api/graphql` by default; that proxy forwards to `API_URL`, `NEXT_PUBLIC_API_URL`, or `http://localhost:8080/graphql` in that order. The Go API should not perform login/signup; it validates bearer tokens with `NEON_AUTH_ISSUER` and `NEON_AUTH_JWKS_URL`, then applies Quorum authorization rules.

## Login-Free Demo Mode

Demo mode is intended for a separate demo database or Neon branch, never the production database. It keeps product flows real by using the normal GraphQL API and authorization checks, but resolves one of three seeded personas from a demo-only header.

Recommended shared demo setup:

```sh
# apps/api/.env on the demo backend
ENABLE_DEMO_MODE=true
DEMO_RESET_ENABLED=true
DATABASE_URL=postgres://...demo-branch...

# apps/web/.env.local on the demo frontend
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
NEXT_PUBLIC_DEMO_RESET_ENABLED=true
API_URL=https://your-demo-api.example.com/graphql
```

After running the standard migrations against the demo database, seed or reset deterministic fixtures:

```sh
cd apps/api
go run ./cmd/demo-seed --reset
```

The web app exposes `/demo` with Student Lead, Project Owner, and Admin Professor personas. The persona cookie is sent only through the Next.js GraphQL proxy and the API accepts it only when `ENABLE_DEMO_MODE=true`. The admin persona can reset demo records from the UI when `DEMO_RESET_ENABLED=true`; the reset command and endpoint delete only records whose seeded users use reserved `demo_%` auth IDs.

Local development does not get auth values automatically from `DATABASE_URL` or the Neon Data API REST URL. Copy `NEON_AUTH_BASE_URL` into `apps/web/.env.local` and `NEON_AUTH_ISSUER`/`NEON_AUTH_JWKS_URL` into `apps/api/.env` from the same Neon Auth branch configuration.

## Open Source Safety

This repo can remain open source because real credentials live outside git. Commit only example env files and setup instructions. Keep Neon connection strings, R2 keys, auth secrets, deploy tokens, and production data out of the repository.
