import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildBetterAuthSpikeOptions } from "./better-auth-options";
import {
  LOCAL_OIDC_CLIENT_ID,
  startLocalOidcProvider,
  type LocalOidcHarness,
} from "./local-oidc-provider";

const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorURL) throw new Error("Provider integration database is required.");

const baseURL = "http://127.0.0.1:3000/api/auth-v2-spike";
const providerId = "local-oidc";
const callbackURL = `${baseURL}/oauth2/callback/${providerId}`;
const schemaSQL = readFileSync(
  resolve(process.cwd(), "lib/auth-v2/spike/better-auth-schema.sql"),
  "utf8",
);
const database = new Pool({
  allowExitOnIdle: true,
  connectionString: operatorURL,
  max: 2,
  options: "-c search_path=better_auth,pg_catalog,pg_temp",
});

class CookieJar {
  readonly #cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    const values =
      (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
      ([headers.get("set-cookie")].filter(Boolean) as string[]);
    for (const value of values) {
      const pair = value.split(";", 1)[0]?.trim();
      const separator = pair?.indexOf("=") ?? -1;
      if (pair && separator > 0) this.#cookies.set(pair.slice(0, separator), pair);
    }
  }

  header(): string {
    return [...this.#cookies.values()].join("; ");
  }
}

function requiredLocation(response: Response, base: string): URL {
  const value = response.headers.get("location");
  if (!value) throw new Error("OIDC fixture response omitted Location");
  return new URL(value, base);
}

async function authorize(authorizationURL: URL): Promise<URL> {
  const jar = new CookieJar();
  let response = await fetch(authorizationURL, { redirect: "manual" });
  jar.absorb(response.headers);
  let location = requiredLocation(response, authorizationURL.origin);
  let prompt: "login" | "consent" = "login";

  for (let step = 0; step < 12; step += 1) {
    if (location.href.startsWith(callbackURL)) return location;
    if (location.origin !== authorizationURL.origin) {
      throw new Error("OIDC fixture attempted an unexpected redirect");
    }
    if (location.pathname.startsWith("/interaction/")) {
      response = await fetch(location, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: jar.header(),
        },
        body: new URLSearchParams(
          prompt === "login"
            ? { prompt, login: "fixture-subject" }
            : { prompt },
        ),
      });
      prompt = "consent";
    } else {
      response = await fetch(location, {
        redirect: "manual",
        headers: { cookie: jar.header() },
      });
    }
    jar.absorb(response.headers);
    location = requiredLocation(response, authorizationURL.origin);
  }
  throw new Error("OIDC fixture exceeded its redirect bound");
}

let harness: LocalOidcHarness;
let auth: { handler(request: Request): Promise<Response> };

async function beginSignIn(): Promise<{ callback: URL; cookies: CookieJar }> {
  const response = await auth.handler(
    new Request(`${baseURL}/sign-in/oauth2`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3000",
      },
      body: JSON.stringify({
        providerId,
        callbackURL: "http://127.0.0.1:3000/accepted",
        disableRedirect: true,
        requestSignUp: true,
      }),
    }),
  );
  expect(response.status).toBe(200);
  const cookies = new CookieJar();
  cookies.absorb(response.headers);
  const payload = (await response.json()) as { url: string };
  const authorizationURL = new URL(payload.url);
  expect(authorizationURL.searchParams.get("redirect_uri")).toBe(callbackURL);
  expect(authorizationURL.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorizationURL.searchParams.get("code_challenge")).toBeTruthy();
  expect(authorizationURL.searchParams.get("state")).toBeTruthy();
  return { callback: await authorize(authorizationURL), cookies };
}

async function finishSignIn(callback: URL, cookies: CookieJar): Promise<Response> {
  return auth.handler(
    new Request(callback, {
      headers: {
        cookie: cookies.header(),
        origin: "http://127.0.0.1:3000",
      },
      redirect: "manual",
    }),
  );
}

describe("Better Auth 1.6.25 exact generic OAuth callback acceptance", () => {
  beforeAll(async () => {
    await database.query(schemaSQL);
    harness = await startLocalOidcProvider({ callbackUrl: callbackURL });
    const options = buildBetterAuthSpikeOptions({
      database,
      baseURL,
      secret: "local-only-auth-spike-secret-32-characters",
      trustedOrigins: ["http://127.0.0.1:3000"],
      sendChangeEmailConfirmation: async () => undefined,
      sendResetPassword: async () => undefined,
      sendVerificationEmail: async () => undefined,
    });
    auth = betterAuth({
      ...options,
      plugins: [
        ...(options.plugins ?? []),
        genericOAuth({
          config: [
            {
              providerId,
              clientId: LOCAL_OIDC_CLIENT_ID,
              discoveryUrl: `${harness.issuer}/.well-known/openid-configuration`,
              issuer: harness.issuer,
              requireIssuerValidation: true,
              scopes: ["openid", "email", "profile"],
              pkce: true,
              authentication: "post",
            },
          ],
        }),
      ],
    });
  });

  afterAll(async () => {
    await harness?.close();
    await database.query("DROP SCHEMA better_auth CASCADE");
    await database.end();
  });

  it("completes the exact callback and denies state tampering and replay", async () => {
    const tampered = await beginSignIn();
    tampered.callback.searchParams.set("state", "tampered-state");
    const tamperedResponse = await finishSignIn(tampered.callback, tampered.cookies);
    expect(tamperedResponse.status).toBeGreaterThanOrEqual(300);
    expect(tamperedResponse.status).toBeLessThan(400);

    const successful = await beginSignIn();
    const accepted = await finishSignIn(successful.callback, successful.cookies);
    expect(accepted.status).toBeGreaterThanOrEqual(300);
    expect(accepted.status).toBeLessThan(400);
    expect(accepted.headers.get("location")).toBe(
      "http://127.0.0.1:3000/accepted",
    );
    const sessionCookie = new CookieJar();
    sessionCookie.absorb(accepted.headers);
    expect(sessionCookie.header()).toContain("quorum_auth_v2_spike.session_token=");

    const persisted = await database.query<{
      accounts: string;
      sessions: string;
      users: string;
    }>(`SELECT
      (SELECT count(*)::text FROM better_auth.account WHERE "providerId" = $1) AS accounts,
      (SELECT count(*)::text FROM better_auth.session) AS sessions,
      (SELECT count(*)::text FROM better_auth."user" WHERE email = $2) AS users`, [
      providerId,
      "fixture-user@example.test",
    ]);
    expect(persisted.rows[0]).toEqual({ accounts: "1", sessions: "1", users: "1" });

    const replay = await finishSignIn(successful.callback, successful.cookies);
    expect(replay.status).toBeGreaterThanOrEqual(300);
    expect(replay.status).toBeLessThan(400);
    expect(replay.headers.get("location")).not.toBe(
      "http://127.0.0.1:3000/accepted",
    );
  });
  it("denies implicit same-email collision and permits an explicit OAuth callback link", async () => {
    await database.query(
      'TRUNCATE better_auth.verification, better_auth.session, better_auth.account, better_auth."user", better_auth."twoFactor", better_auth."rateLimit" CASCADE',
    );
    const email = "fixture-user@example.test";
    const password = "kL8!".repeat(16);
    const signup = await auth.handler(
      new Request(`${baseURL}/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({ email, name: "Fixture User", password }),
      }),
    );
    expect(signup.status).toBe(200);
    await database.query(
      'UPDATE better_auth."user" SET "emailVerified" = true WHERE email = $1',
      [email],
    );

    const collision = await beginSignIn();
    const collisionResponse = await finishSignIn(
      collision.callback,
      collision.cookies,
    );
    expect(collisionResponse.status).toBeGreaterThanOrEqual(300);
    expect(collisionResponse.status).toBeLessThan(400);
    expect(
      (
        await database.query(
          'SELECT 1 FROM better_auth.account WHERE "providerId" = $1',
          [providerId],
        )
      ).rowCount,
    ).toBe(0);

    await database.query('TRUNCATE better_auth."rateLimit"');
    const signin = await auth.handler(
      new Request(`${baseURL}/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(signin.status).toBe(200);
    const linkCookies = new CookieJar();
    linkCookies.absorb(signin.headers);
    const link = await auth.handler(
      new Request(`${baseURL}/oauth2/link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: linkCookies.header(),
          origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({
          providerId,
          callbackURL: "http://127.0.0.1:3000/linked",
        }),
      }),
    );
    expect(link.status).toBe(200);
    linkCookies.absorb(link.headers);
    const linkPayload = (await link.json()) as { url: string };
    const authorizationURL = new URL(linkPayload.url);
    expect(authorizationURL.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    const callback = await authorize(authorizationURL);
    const linked = await finishSignIn(callback, linkCookies);
    expect(linked.status).toBeGreaterThanOrEqual(300);
    expect(linked.status).toBeLessThan(400);
    expect(linked.headers.get("location")).toBe(
      "http://127.0.0.1:3000/linked",
    );

    const accounts = await database.query<{
      providerId: string;
      userId: string;
    }>('SELECT "providerId", "userId" FROM better_auth.account ORDER BY "providerId"');
    expect(accounts.rows).toHaveLength(2);
    expect(new Set(accounts.rows.map((account) => account.userId)).size).toBe(1);
    expect(accounts.rows.map((account) => account.providerId)).toEqual([
      "credential",
      providerId,
    ]);
  });
});
