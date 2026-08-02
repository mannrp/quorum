# Auth V2 finish plan

This is the only Auth V2 delivery plan. `STATUS.md` states current reality, `AUTH_V2_CONTRACT.md` contains durable security rules, and git/CI hold completed implementation history. This file contains only the remaining path to release.

## Definition of finished

Auth V2 is finished when a fresh browser can register or sign in with email/password or Google, enroll as Student or Sponsor, use every enabled Quorum workflow, manage its profile, credentials, and sessions, and sign out without any legacy identity path.

Admin and file-management features are disabled and are not Auth V2 completion blockers. Their old authority, upload, and public-URL paths must remain unreachable.

The release must have:

- one Better Auth configuration and browser client;
- one opaque host-only session cookie;
- one short-lived Next-to-Go assertion path;
- current-state Go principal and authorization checks;
- registered browser operations only, with no browser-supplied GraphQL;
- only Next exposed publicly and a protected production Next-to-Go transport;
- no Neon Auth, legacy bearer verifier, `ADMIN_EMAILS`, demo identity, public file URL, or browser-visible Go endpoint;
- green local, service-backed, browser, build, and pinned Ubuntu checks.

## Current position

The application path is implemented. Better Auth owns browser authentication, Next exposes typed same-origin operations, private Go resolves current authorization, and enabled Student/Sponsor workflows run end to end. Production images, migrations, the Unix-socket boundary, local service-backed tests, browser tests, and pinned Ubuntu CI are green. `STATUS.md` is the concise capability and evidence record.

P4 release validation is the only remaining phase. It depends on the real release host, database, Google application, and mail provider; it does not require another application framework or feature layer.

## Remaining release path

1. **Configure the release environment.** Create the three secret files described in `OPERATIONS.md`, provision private TLS PostgreSQL access, and place an HTTPS proxy in front of loopback Next. Keep Go and PostgreSQL private.
2. **Prove database operations.** Take and restore a backup, run the canonical forward migrations, and verify that the prior compatible application image can be restored or that the affected feature can be safely disabled.
3. **Prove the service boundary.** Start the production Compose shape, check health and graceful shutdown, confirm socket ownership/mode and read-only web access, reject TCP/plaintext fallback, and rotate the assertion signing key through an overlap and retirement cycle.
4. **Prove real providers.** Complete register, verification, sign-in, reset, email change, and Google link/sign-in flows using the production origin, exact Google callback, and transactional mailboxes.
5. **Release.** Re-run the baseline and service-backed commands, review runtime dependency advisories, make the pull request ready, merge, deploy the exact verified commit, and perform a short post-deploy smoke test.

If the release host cannot support the one-host socket, replace only that transport with mTLS and record the concrete reason in `STATUS.md`. When all five steps pass, set `STATUS.md` to `complete`. There is no later Auth V2 gate.

## Working rules

- Start any behavior change with a focused failing test and retain all security negative controls.
- Prefer small explicit functions and existing domain logic; add an abstraction only at a real external boundary.
- Internal GraphQL may remain private. Browser requests remain typed registered operations.
- Do not introduce another auth path, deployment framework, planning document, or migration history.
- Update `STATUS.md` only when release truth changes. Use git and CI for detailed history.

## Deliberately out of scope

These are separate product requests, not unfinished Auth V2 work:

- re-enabling Admin, which first requires MFA, recovery, and bootstrap policy;
- file upload/download and storage-vendor integration;
- Professor invitation machinery not used by the enabled UI;
- providers beyond Google and email/password;
- generic workflow/worker or policy platforms;
- GraphQL-versus-HTTP benchmarks without a measured production problem;
- authorization or retention workflows for disabled features.
