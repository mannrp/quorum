import { afterAll, beforeAll, describe, expect, it } from "vitest";

const origin = "http://127.0.0.1:3000";
const mailpitURL = "http://127.0.0.1:8025";
const email = `auth-v2-${Date.now()}@example.test`;
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

async function waitForVerificationURL(): Promise<string> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const list = await fetch(`${mailpitURL}/api/v1/messages`, { cache: "no-store" });
    if (!list.ok) throw new Error(`Mailpit list failed: ${list.status}`);
    const value = await list.json() as { messages?: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
    const summary = value.messages?.find((message) =>
      message.Subject === "Verify your Quorum email" &&
      message.To.some((recipient) => recipient.Address === email),
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
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    await pool.end();
  });

  it("registers, delivers verification, verifies once, signs in, and signs out with an opaque HttpOnly cookie", async () => {
    const registration = await post("/sign-up/email", {
      email,
      name: "Auth V2 Integration",
      password,
    });
    expect(registration.status).toBe(200);

    const verificationURL = await waitForVerificationURL();
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
    expect(await signIn.clone().text()).not.toContain(setCookie.split(";", 1)[0]?.split("=", 2)[1] ?? "never");

    const cookie = setCookie.split(";", 1)[0];
    const signOut = await post("/sign-out", {}, cookie);
    expect(signOut.status).toBe(200);
  });

  it("rejects a wrong origin", async () => {
    const response = await handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://wrong.example" },
      body: JSON.stringify({ email, password }),
    }));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
