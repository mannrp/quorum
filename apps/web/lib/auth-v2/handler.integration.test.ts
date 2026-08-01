import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const origin = "http://127.0.0.1:3000";
const mailpitURL = "http://127.0.0.1:8025";
const email = `auth-v2-${Date.now()}@example.test`;
const externalEmail = `auth-v2-external-${Date.now()}@example.test`;
const unverifiedEmail = `auth-v2-unverified-${Date.now()}@example.test`;
const expiredEmail = `auth-v2-expired-${Date.now()}@example.test`;
const linkEmail = "oidc-link@example.test";
const password = "correct horse battery staple 123";
let handler: (request: Request) => Promise<Response>;

function sessionCookie(response: Response): string {
  const match = (response.headers.get("set-cookie") ?? "").match(/(?:^|,\s*)(quorum\.session_token=[^;,\s]+)/);
  if (!match) throw new Error("Auth response did not set a session cookie.");
  return match[1];
}
function post(path: string, body: unknown, cookie?: string) {
  return handler(new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": "same-origin",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  }));
}

async function waitForVerificationURL(targetEmail = email): Promise<string> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const list = await fetch(`${mailpitURL}/api/v1/messages`, { cache: "no-store" });
    if (!list.ok) throw new Error(`Mailpit list failed: ${list.status}`);
    const value = await list.json() as { messages?: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
    const summary = value.messages?.find((message) =>
      message.Subject === "Verify your Quorum email" &&
      message.To.some((recipient) => recipient.Address === targetEmail),
    );
    if (summary) {
      const detail = await fetch(`${mailpitURL}/api/v1/message/${encodeURIComponent(summary.ID)}`);
      if (!detail.ok) throw new Error(`Mailpit message failed: ${detail.status}`);
      const message = await detail.json() as { Text?: string };
      const match = message.Text?.match(/https?:\/\/\S+/);
      if (!match) throw new Error("Verification mail did not contain a URL.");
      return match[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Verification mail was not delivered.");
}

async function expireVerification(verificationURL: string): Promise<void> {
  const token = new URL(verificationURL).searchParams.get("token");
  if (!token) throw new Error("Verification URL has no token.");
  const digest = createHash("sha256").update(token, "utf8").digest("base64url");
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query("UPDATE \"verification\" SET \"expiresAt\" = now() - interval '1 second' WHERE \"identifier\" = $1 AND \"value\" = $2", [
      "quorum:email-verification",
      digest,
    ]);
    expect(result.rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}

async function expireOAuthState(state: string): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query(
      'UPDATE "verification" SET "expiresAt" = now() - interval \'1 second\', "value" = jsonb_set("value"::jsonb, \'{expiresAt}\', to_jsonb((extract(epoch FROM now() - interval \'1 second\') * 1000)::bigint))::text WHERE "identifier" = $1',
      [state],
    );
    expect(result.rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}
async function clearRateLimits(): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    await pool.query('DELETE FROM "rateLimit"');
  } finally {
    await pool.end();
  }
}

async function ageSessionsForEmail(targetEmail: string): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query(
      'UPDATE "session" s SET "createdAt" = now() - interval \'11 minutes\' FROM "user" u WHERE s."userId" = u."id" AND u."email" = $1',
      [targetEmail],
    );
    expect(result.rowCount).toBeGreaterThan(0);
  } finally {
    await pool.end();
  }
}
async function storedSessionTokens(): Promise<string[]> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query<{ token: string }>(
      'SELECT s."token" FROM "session" s JOIN "user" u ON u."id" = s."userId" WHERE u."email" = $1',
      [email],
    );
    return result.rows.map((row) => row.token);
  } finally {
    await pool.end();
  }
}

type TestOIDCIdentity = Readonly<{ userId: string; accountCount: number }>;

async function testOIDCIdentity(): Promise<TestOIDCIdentity> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query<{ userId: string; accountCount: string }>(
      'SELECT a."userId", count(*)::text AS "accountCount" FROM "account" a WHERE a."providerId" = $1 AND a."accountId" = $2 GROUP BY a."userId"',
      ["quorum-test-oidc", "deterministic-google-subject"],
    );
    if (result.rowCount !== 1) throw new Error("Expected one deterministic OAuth identity.");
    return { userId: result.rows[0].userId, accountCount: Number(result.rows[0].accountCount) };
  } finally {
    await pool.end();
  }
}
async function testOIDCAccountState(): Promise<{ email: string; providers: string[] }> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query<{ email: string; providers: string[] }>(
      'SELECT u."email", array_agg(a."providerId" ORDER BY a."providerId") AS providers FROM "user" u JOIN "account" a ON a."userId" = u."id" WHERE EXISTS (SELECT 1 FROM "account" oidc WHERE oidc."userId" = u."id" AND oidc."providerId" = $1 AND oidc."accountId" = $2) GROUP BY u."id", u."email"',
      ["quorum-test-oidc", "deterministic-google-subject"],
    );
    if (result.rowCount !== 1) throw new Error("Expected one deterministic OAuth account state.");
    return result.rows[0];
  } finally {
    await pool.end();
  }
}
async function latestTestOIDCSessionMethods(): Promise<string> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  try {
    const result = await pool.query<{ authenticationMethods: string }>(
      'SELECT s."authenticationMethods" FROM "session" s JOIN "account" a ON a."userId" = s."userId" WHERE a."providerId" = $1 ORDER BY s."createdAt" DESC LIMIT 1',
      ["quorum-test-oidc"],
    );
    if (result.rowCount !== 1) throw new Error("Deterministic OAuth session was not persisted.");
    return result.rows[0].authenticationMethods;
  } finally {
    await pool.end();
  }
}
describe("real Better Auth handler", () => {
  beforeAll(async () => {
    if (process.env.QUORUM_REQUIRE_INTEGRATION !== "true") {
      throw new Error("QUORUM_REQUIRE_INTEGRATION=true is required.");
    }
    handler = (await import("./server")).handleAuthRequest;
  });

  afterAll(async () => {
    if (!process.env.AUTH_DATABASE_URL) return;
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.AUTH_DATABASE_URL,
      options: "-c search_path=better_auth,pg_catalog,pg_temp",
    });
    await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [[email, externalEmail, unverifiedEmail, expiredEmail, linkEmail]]);
    await pool.query('DELETE FROM "rateLimit"');
    await pool.end();
  });

  it("registers, verifies, enrolls, loads the viewer twice, and signs out with an opaque HttpOnly cookie", async () => {
    const registration = await post("/sign-up/email", {
      callbackURL: "/auth/complete",
      email,
      name: "Auth V2 Integration",
      password,
    });
    expect(registration.status).toBe(200);

    const invalidVerification = await handler(new Request(
      `${origin}/api/auth/verify-email?token=invalid&callbackURL=%2Fauth%2Fcomplete`,
      { headers: { origin }, redirect: "manual" },
    ));
    expect(invalidVerification.status).toBe(410);

    const verificationURL = await waitForVerificationURL();
    expect(new URL(verificationURL).origin).toBe(origin);
    const callbackURL = new URL(verificationURL).searchParams.get("callbackURL");
    expect(callbackURL).toMatch(/^\/(?!\/)/);
    const verification = await handler(new Request(verificationURL, {
      headers: { origin },
      redirect: "manual",
    }));
    expect([200, 302]).toContain(verification.status);

    const replay = await handler(new Request(verificationURL, {
      headers: { origin },
      redirect: "manual",
    }));
    expect(replay.status).toBe(410);

    const signIn = await post("/sign-in/email", { email, password });
    expect(signIn.status).toBe(200);
    const setCookie = signIn.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toMatch(/Domain=/i);

    const signInBody = await signIn.clone().text();
    const rawTokens = await storedSessionTokens();
    expect(rawTokens.length).toBeGreaterThan(0);
    for (const token of rawTokens) expect(signInBody).not.toContain(token);
    expect(signInBody).not.toContain(setCookie.split(";", 1)[0]?.split("=", 2)[1] ?? "never");

    const cookie = setCookie.split(";", 1)[0];
    const enrollmentRoute = (await import("../../app/api/v1/enrollment/route")).POST;
    const viewerRoute = (await import("../../app/api/v1/viewer/route")).GET;

    const bearerReuse = await viewerRoute(new Request(origin + "/api/v1/viewer", {
      headers: { authorization: `Bearer ${rawTokens[0]}` },
    }));
    expect(bearerReuse.status).toBe(401);

    const enrollment = await enrollmentRoute(new Request(origin + "/api/v1/enrollment", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin,
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({ role: "STUDENT" }),
    }));
    expect(enrollment.status).toBe(200);
    const enrollmentBody = await enrollment.json() as { viewer: Record<string, unknown> };
    expect(enrollmentBody.viewer).toMatchObject({
      accountState: "ACTIVE",
      onboardingState: "NOT_STARTED",
      selfServiceRoles: ["STUDENT"],
    });
    expect(enrollmentBody.viewer).not.toHaveProperty("email");
    expect(enrollmentBody.viewer).not.toHaveProperty("authUserId");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const viewer = await viewerRoute(new Request(origin + "/api/v1/viewer", { headers: { cookie } }));
      expect(viewer.status).toBe(200);
      expect(viewer.headers.get("cache-control")).toBe("private, no-store");
      expect((await viewer.json()) as object).toEqual(enrollmentBody);
    }

    const accounts = await handler(new Request(`${origin}/api/auth/list-accounts`, { headers: { cookie, origin } }));
    expect(accounts.status).toBe(200);
    expect(await accounts.json()).toEqual([{ providerId: "credential" }]);

    const freshLink = await post("/link-social", {
      provider: "google",
      callbackURL: "/settings/account?linked=google",
      errorCallbackURL: "/settings/account?link=error",
    }, cookie);
    expect(freshLink.status).toBe(200);
    const freshLinkBody = await freshLink.json() as { url?: string };
    expect(new URL(freshLinkBody.url!).origin).toBe("https://accounts.google.com");

    await ageSessionsForEmail(email);
    const staleLink = await post("/link-social", {
      provider: "google",
      callbackURL: "/settings/account?linked=google",
      errorCallbackURL: "/settings/account?link=error",
    }, cookie);
    expect(staleLink.status).toBe(403);
    const signOut = await post("/sign-out", {}, cookie);
    expect(signOut.status).toBe(200);
    const afterLogout = await viewerRoute(new Request(origin + "/api/v1/viewer", { headers: { cookie } }));
    expect(afterLogout.status).toBe(401);
  });

  it("enforces state, S256 PKCE, issuer, exact callback, and one-use OAuth callbacks", async () => {
    await clearRateLimits();
    const oidcBaseURL = process.env.AUTH_TEST_OIDC_BASE_URL;
    if (!oidcBaseURL) throw new Error("AUTH_TEST_OIDC_BASE_URL is required.");

    async function beginOAuth() {
      await clearRateLimits();
      const start = await post("/sign-in/oauth2", {
        providerId: "quorum-test-oidc",
        callbackURL: "/auth/complete",
        newUserCallbackURL: "/auth/complete",
        errorCallbackURL: "/auth/login?oauth=error",
      });
      expect(start.status).toBe(200);
      const body = await start.json() as { url?: string };
      expect(body.url).toBeTruthy();
      const authorizationURL = new URL(body.url!);
      expect(authorizationURL.origin).toBe(oidcBaseURL);
      const stateCookie = (start.headers.get("set-cookie") ?? "").split(";", 1)[0];
      expect(stateCookie).toBeTruthy();

      const authorization = await fetch(authorizationURL, { redirect: "manual" });
      expect(authorization.status).toBe(302);
      const callback = new URL(authorization.headers.get("location")!);
      expect(callback.origin).toBe(origin);
      expect(callback.pathname).toBe("/api/auth/oauth2/callback/quorum-test-oidc");
      expect(callback.searchParams.get("iss")).toBe(oidcBaseURL);
      return { callback, stateCookie };
    }

    const metadataResponse = await fetch(`${oidcBaseURL}/last`);
    expect(metadataResponse.status).toBe(200);

    const wrongOriginStart = await handler(new Request(`${origin}/api/auth/sign-in/oauth2`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://wrong.example" },
      body: JSON.stringify({
        providerId: "quorum-test-oidc",
        callbackURL: "/auth/complete",
        errorCallbackURL: "/auth/login?oauth=error",
      }),
    }));
    expect(wrongOriginStart.status).toBeGreaterThanOrEqual(400);

    const externalReturn = await post("/sign-in/oauth2", {
      providerId: "quorum-test-oidc",
      callbackURL: "https://wrong.example/steal",
      errorCallbackURL: "/auth/login?oauth=error",
    });
    expect(externalReturn.status).toBeGreaterThanOrEqual(400);

    const missingCookieFlow = await beginOAuth();
    const missingCookie = await handler(new Request(missingCookieFlow.callback, {
      headers: { origin },
      redirect: "manual",
    }));
    expect(missingCookie.status).toBeGreaterThanOrEqual(300);
    expect(missingCookie.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");

    const deniedFlow = await beginOAuth();
    deniedFlow.callback.searchParams.delete("code");
    deniedFlow.callback.searchParams.set("error", "access_denied");
    deniedFlow.callback.searchParams.set("error_description", "user_cancelled");
    const denied = await handler(new Request(deniedFlow.callback, {
      headers: { cookie: deniedFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(denied.status).toBeGreaterThanOrEqual(300);
    expect(denied.headers.get("location") ?? "").toContain("/auth/login?oauth=error");
    expect(denied.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");

    const missingStateFlow = await beginOAuth();
    missingStateFlow.callback.searchParams.delete("state");
    const missingState = await handler(new Request(missingStateFlow.callback, {
      headers: { cookie: missingStateFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(missingState.status).toBeGreaterThanOrEqual(300);
    expect(missingState.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");

    const expiredStateFlow = await beginOAuth();
    await expireOAuthState(expiredStateFlow.callback.searchParams.get("state")!);
    const expiredState = await handler(new Request(expiredStateFlow.callback, {
      headers: { cookie: expiredStateFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(expiredState.status).toBeGreaterThanOrEqual(300);
    expect(expiredState.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");
    const wrongIssuerFlow = await beginOAuth();
    wrongIssuerFlow.callback.searchParams.set("iss", "https://wrong.example");
    const wrongIssuer = await handler(new Request(wrongIssuerFlow.callback, {
      headers: { cookie: wrongIssuerFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(wrongIssuer.status).toBeGreaterThanOrEqual(300);
    expect(wrongIssuer.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");

    const successFlow = await beginOAuth();
    const metadata = await (await fetch(`${oidcBaseURL}/last`)).json() as {
      authorization: { redirectURI: string; challengeMethod: string; scope: string; issuer: string };
    };
    expect(metadata.authorization).toEqual({
      redirectURI: `${origin}/api/auth/oauth2/callback/quorum-test-oidc`,
      challengeMethod: "S256",
      scope: "openid email profile",
      issuer: oidcBaseURL,
    });

    const success = await handler(new Request(successFlow.callback, {
      headers: { cookie: successFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe("/auth/complete");
    expect(success.headers.get("set-cookie") ?? "").toContain("quorum.session_token=");
    expect(success.headers.get("set-cookie") ?? "").toContain("HttpOnly");
    expect(await latestTestOIDCSessionMethods()).toBe('["google"]');
    const firstIdentity = await testOIDCIdentity();
    expect(firstIdentity.accountCount).toBe(1);

    const returningFlow = await beginOAuth();
    const returning = await handler(new Request(returningFlow.callback, {
      headers: { cookie: returningFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(returning.status).toBe(302);
    expect(returning.headers.get("set-cookie") ?? "").toContain("quorum.session_token=");
    expect(await testOIDCIdentity()).toEqual(firstIdentity);
    const returningCookie = sessionCookie(returning);
    const soleMethodUnlink = await post("/unlink-account", { providerId: "quorum-test-oidc" }, returningCookie);
    expect(soleMethodUnlink.status).toBeGreaterThanOrEqual(400);
    const returningAccounts = await handler(new Request(`${origin}/api/auth/list-accounts`, {
      headers: { cookie: returningCookie, origin },
    }));
    expect(returningAccounts.status).toBe(200);
    expect(await returningAccounts.json()).toEqual([{ providerId: "quorum-test-oidc" }]);

    await clearRateLimits();
    const beforeCollision = await testOIDCAccountState();
    const collision = await post("/sign-up/email", {
      callbackURL: "/auth/complete",
      email: beforeCollision.email,
      name: "Same Email Different Method",
      password,
    });
    expect(collision.status).toBe(200);
    expect(collision.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");
    expect(await testOIDCAccountState()).toEqual(beforeCollision);
    expect(beforeCollision.providers).toEqual(["quorum-test-oidc"]);

    const replay = await handler(new Request(successFlow.callback, {
      headers: { cookie: successFlow.stateCookie, origin },
      redirect: "manual",
    }));
    expect(replay.status).toBeGreaterThanOrEqual(300);
    expect(replay.headers.get("set-cookie") ?? "").not.toContain("quorum.session_token=");
  });

  it("explicitly links and unlinks Google while preserving the password method", async () => {
    await clearRateLimits();
    const registration = await post("/sign-up/email", {
      callbackURL: "/auth/complete",
      email: linkEmail,
      name: "OIDC Link User",
      password,
    });
    expect(registration.status).toBe(200);
    const verification = await handler(new Request(await waitForVerificationURL(linkEmail), {
      headers: { origin },
      redirect: "manual",
    }));
    expect([200, 302]).toContain(verification.status);

    const signIn = await post("/sign-in/email", { email: linkEmail, password });
    expect(signIn.status).toBe(200);
    const cookie = sessionCookie(signIn);

    const link = await post("/link-social", {
      provider: "google",
      idToken: { token: "quorum-test-google-link-token" },
    }, cookie);
    expect(link.status).toBe(200);

    const linkedAccounts = await handler(new Request(`${origin}/api/auth/list-accounts`, {
      headers: { cookie, origin },
    }));
    expect(linkedAccounts.status).toBe(200);
    expect(await linkedAccounts.json()).toEqual([
      { providerId: "credential" },
      { providerId: "google" },
    ]);

    const unlink = await post("/unlink-account", { providerId: "google" }, cookie);
    expect(unlink.status).toBe(200);
    const remainingAccounts = await handler(new Request(`${origin}/api/auth/list-accounts`, {
      headers: { cookie, origin },
    }));
    expect(remainingAccounts.status).toBe(200);
    expect(await remainingAccounts.json()).toEqual([{ providerId: "credential" }]);
  });
  it("rejects wrong origin, wrong content type, and an external callback", async () => {
    const unverifiedRegistration = await post("/sign-up/email", {
      callbackURL: "/auth/complete",
      email: unverifiedEmail,
      name: "Unverified Login",
      password,
    });
    expect(unverifiedRegistration.status).toBe(200);
    const unverified = await post("/sign-in/email", { email: unverifiedEmail, password });
    expect(unverified.status).toBeGreaterThanOrEqual(400);
    const expiredRegistration = await post("/sign-up/email", {
      callbackURL: "/auth/complete",
      email: expiredEmail,
      name: "Expired Verification",
      password,
    });
    expect(expiredRegistration.status).toBe(200);
    const expiredURL = await waitForVerificationURL(expiredEmail);
    await expireVerification(expiredURL);
    const expiredVerification = await handler(new Request(expiredURL, { headers: { origin }, redirect: "manual" }));
    expect(expiredVerification.status).toBe(410);

    const wrongOrigin = await handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://wrong.example" },
      body: JSON.stringify({ email, password }),
    }));
    expect(wrongOrigin.status).toBeGreaterThanOrEqual(400);

    const wrongContentType = await handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "text/plain", origin },
      body: JSON.stringify({ email, password }),
    }));
    expect(wrongContentType.status).toBeGreaterThanOrEqual(400);

    const externalCallback = await post("/sign-up/email", {
      callbackURL: "https://wrong.example/steal",
      email: externalEmail,
      name: "External Callback",
      password,
    });
    expect(externalCallback.status).toBeGreaterThanOrEqual(400);
  });
});
