import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const origin = "http://127.0.0.1:3000";
const mailpitURL = "http://127.0.0.1:8025";
const email = `auth-v2-${Date.now()}@example.test`;
const externalEmail = `auth-v2-external-${Date.now()}@example.test`;
const unverifiedEmail = `auth-v2-unverified-${Date.now()}@example.test`;
const expiredEmail = `auth-v2-expired-${Date.now()}@example.test`;
const password = "correct horse battery staple 123";
let handler: (request: Request) => Promise<Response>;

function post(path: string, body: unknown, cookie?: string) {
  return handler(new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
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
    await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [[email, externalEmail, unverifiedEmail, expiredEmail]]);
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

    const signOut = await post("/sign-out", {}, cookie);
    expect(signOut.status).toBe(200);
    const afterLogout = await viewerRoute(new Request(origin + "/api/v1/viewer", { headers: { cookie } }));
    expect(afterLogout.status).toBe(401);
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
