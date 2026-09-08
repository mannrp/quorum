// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseAuthEnvironment } from "./config";

const validEnvironment = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "q".repeat(32),
  BETTER_AUTH_URL: "https://quorum.example",
  AUTH_DATABASE_URL: "postgresql://quorum_auth_runtime:secret@postgres:5432/quorum",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
};

describe("Auth V2 server configuration", () => {
  it("builds the accepted production policy without a domain cookie", () => {
    expect(parseAuthEnvironment(validEnvironment)).toEqual({
      baseURL: "https://quorum.example",
      databaseURL: validEnvironment.AUTH_DATABASE_URL,
      secret: validEnvironment.BETTER_AUTH_SECRET,
      trustedOrigins: ["https://quorum.example"],
      cookie: { secure: true, httpOnly: true, sameSite: "lax" },
      password: { minLength: 8, maxLength: 128 },
      requireEmailVerification: true,
      session: { idleSeconds: 86_400, absoluteSeconds: 604_800, recentAuthSeconds: 600 },
      databaseSchema: "better_auth",
      allowImplicitSameEmailLinking: false,
      google: {
        clientId: "google-client",
        clientSecret: "google-secret",
        callbackURL: "https://quorum.example/api/auth/callback/google",
      },
    });
  });

  it.each([
    ["a short secret", { BETTER_AUTH_SECRET: "too-short" }],
    ["an insecure production origin", { BETTER_AUTH_URL: "http://quorum.example" }],
    ["an origin with credentials", { BETTER_AUTH_URL: "https://user:pass@quorum.example" }],
    ["an origin with a path", { BETTER_AUTH_URL: "https://quorum.example/auth" }],
    ["a non-PostgreSQL database", { AUTH_DATABASE_URL: "mysql://db/quorum" }],
  ])("rejects %s", (_label, override) => {
    expect(() => parseAuthEnvironment({ ...validEnvironment, ...override })).toThrow();
  });

  it.each([
    [{ GOOGLE_CLIENT_ID: "" }],
    [{ GOOGLE_CLIENT_SECRET: "" }],
  ])("rejects incomplete Google credentials", (override) => {
    expect(() => parseAuthEnvironment({ ...validEnvironment, ...override })).toThrow(/Google credentials/);
  });

  it("rejects the deterministic OIDC provider in production", () => {
    expect(() => parseAuthEnvironment({
      ...validEnvironment,
      AUTH_TEST_OIDC_BASE_URL: "http://127.0.0.1:19090",
      AUTH_TEST_OIDC_CLIENT_ID: "test-client",
      AUTH_TEST_OIDC_CLIENT_SECRET: "test-secret",
    })).toThrow(/nonproduction/);
  });

  it("accepts the complete loopback deterministic OIDC configuration in development", () => {
    const config = parseAuthEnvironment({
      ...validEnvironment,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      AUTH_TEST_OIDC_BASE_URL: "http://127.0.0.1:19090",
      AUTH_TEST_OIDC_CLIENT_ID: "test-client",
      AUTH_TEST_OIDC_CLIENT_SECRET: "test-secret",
    });
    expect(config.testOIDC).toEqual({
      baseURL: "http://127.0.0.1:19090",
      clientId: "test-client",
      clientSecret: "test-secret",
    });
  });

  it("allows the email-verification bypass only outside production", () => {
    expect(parseAuthEnvironment({
      ...validEnvironment,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
    }).requireEmailVerification).toBe(false);
    expect(() => parseAuthEnvironment({ ...validEnvironment, AUTH_REQUIRE_EMAIL_VERIFICATION: "false" })).toThrow(/production/);
    expect(() => parseAuthEnvironment({ ...validEnvironment, AUTH_REQUIRE_EMAIL_VERIFICATION: "sometimes" })).toThrow(/AUTH_REQUIRE_EMAIL_VERIFICATION/);
  });

  it("permits an explicit HTTP loopback origin only outside production", () => {
    const config = parseAuthEnvironment({
      ...validEnvironment,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
    });

    expect(config.baseURL).toBe("http://127.0.0.1:3000");
    expect(config.cookie.secure).toBe(false);
  });
});
