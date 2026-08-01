// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { BetterAuthOptions } from "better-auth";
import { buildBetterAuthOptions, resolveAuthenticationMethods } from "./options";

describe("session authentication method provenance", () => {
  it.each([
    ["/sign-in/email", undefined, '["password"]'],
    ["/sign-up/email", undefined, '["password"]'],
    ["/callback/google", { id: "google" }, '["google"]'],
    ["/oauth2/callback/quorum-test-oidc", { providerId: "quorum-test-oidc" }, '["google"]'],
  ])("maps %s to the reviewed method", (path, params, expected) => {
    expect(resolveAuthenticationMethods({ path, params })).toBe(expected);
  });

  it("rejects session creation when the authentication method is unknown", () => {
    expect(() => resolveAuthenticationMethods({ path: "/unknown" })).toThrow(
      "Unsupported session authentication method",
    );
  });
});

describe("Better Auth production options", () => {
  it("enforces the accepted cookie, password, session, linking, and database rate-limit policy", () => {
    const database = {} as NonNullable<BetterAuthOptions["database"]>;
    const send = vi.fn();
    const options = buildBetterAuthOptions({
      config: {
        baseURL: "https://quorum.example",
        databaseURL: "postgresql://unused",
        secret: "q".repeat(32),
        trustedOrigins: ["https://quorum.example"],
        cookie: { secure: true, httpOnly: true, sameSite: "lax" },
        password: { minLength: 29, maxLength: 128 },
        session: { idleSeconds: 86_400, absoluteSeconds: 604_800, recentAuthSeconds: 600 },
        databaseSchema: "better_auth",
        allowImplicitSameEmailLinking: false,
        testOIDC: {
          baseURL: "http://127.0.0.1:19090",
          clientId: "test-client",
          clientSecret: "test-secret",
        },
        google: {
          clientId: "google-client",
          clientSecret: "google-secret",
          callbackURL: "https://quorum.example/api/auth/callback/google",
        },
      },
      database,
      sendChangeEmailConfirmation: send,
      sendResetPassword: send,
      sendVerificationEmail: send,
    });

    expect(options.database).toBe(database);
    expect(options.trustedOrigins).toEqual(["https://quorum.example"]);
    expect(options.advanced).toMatchObject({
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: true },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
    });
    expect(options.advanced?.defaultCookieAttributes).not.toHaveProperty("domain");
    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 29,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    });
    expect(options.session).toMatchObject({
      cookieCache: { enabled: false },
      expiresIn: 86_400,
      freshAge: 600,
    });
    expect(options.account?.accountLinking).toMatchObject({
      disableImplicitLinking: true,
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    });
    expect(options.rateLimit).toMatchObject({ enabled: true, storage: "database" });
    expect(options.onAPIError).toMatchObject({ errorURL: "/auth/login?oauth=error" });
    expect(options.plugins).toHaveLength(1);
    const googleOptions = options.socialProviders?.google;
    expect(googleOptions).toBeTypeOf("object");
    if (!googleOptions || typeof googleOptions === "function") throw new Error("Expected static Google options.");
    expect(googleOptions.verifyIdToken).toBeTypeOf("function");
    expect(googleOptions.getUserInfo).toBeTypeOf("function");
    expect(googleOptions).toMatchObject({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectURI: "https://quorum.example/api/auth/callback/google",
      scope: ["openid", "email", "profile"],
    });
  });
});
