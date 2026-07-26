import { describe, expect, it, vi } from "vitest";

import { buildAuthProviderSpikeOptions } from "./provider-options";
import type { AuthProviderSpikeRuntimeConfig } from "./runtime-config";

const runtime: AuthProviderSpikeRuntimeConfig = {
  baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
  databaseURL: "postgres://user:password@127.0.0.1:55432/quorum",
  postgresOptions: "-c search_path=better_auth,pg_catalog,pg_temp",
  secret: "a".repeat(32),
  trustedOrigins: ["http://127.0.0.1:3000"],
};

describe("Better Auth acceptance-spike options", () => {
  it("sets the accepted password, session, origin, cookie, rate, and plugin policy", () => {
    const options = buildAuthProviderSpikeOptions({
      database: {} as never,
      runtime,
      sendChangeEmailConfirmation: vi.fn(),
      sendResetPassword: vi.fn(),
      sendVerificationEmail: vi.fn(),
    });

    expect(options.baseURL).toBe(runtime.baseURL);
    expect(options.trustedOrigins).toEqual(runtime.trustedOrigins);
    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 15,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    });
    expect(options.session).toMatchObject({
      cookieCache: { enabled: false },
      expiresIn: 28_800,
      freshAge: 300,
      updateAge: 900,
    });
    expect(options.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
    });
    expect(options.advanced).toMatchObject({
      cookiePrefix: "quorum_auth_v2_spike",
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
    });
    expect(options.plugins?.map((plugin) => plugin.id)).toEqual([
      "have-i-been-pwned",
      "two-factor",
    ]);
  });
});
