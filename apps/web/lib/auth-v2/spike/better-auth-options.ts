import type { BetterAuthOptions } from "better-auth";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";

type EmailVerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>;
type EmailPasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>;
type ChangeEmailOptions = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["changeEmail"]
>;

type BetterAuthSpikeOptionInputs = Readonly<{
  database: NonNullable<BetterAuthOptions["database"]>;
  baseURL: string;
  secret: string;
  trustedOrigins: readonly string[];
  sendChangeEmailConfirmation: NonNullable<
    ChangeEmailOptions["sendChangeEmailConfirmation"]
  >;
  sendResetPassword: NonNullable<EmailPasswordOptions["sendResetPassword"]>;
  sendVerificationEmail: NonNullable<
    EmailVerificationOptions["sendVerificationEmail"]
  >;
}>;

// Candidate configuration only. This module is confined to the development/test
// spike and must not be imported by a production route.
export function buildBetterAuthSpikeOptions({
  database,
  baseURL,
  secret,
  trustedOrigins,
  sendChangeEmailConfirmation,
  sendResetPassword,
  sendVerificationEmail,
}: BetterAuthSpikeOptionInputs): BetterAuthOptions {
  return {
    advanced: {
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
    },
    appName: "Quorum Auth V2 Acceptance Spike",
    baseURL,
    database,
    emailAndPassword: {
      enabled: true,
      // Better Auth measures JavaScript UTF-16 code units. D-034 proves that
      // 29 units exclude every possible 14-code-point password.
      minPasswordLength: 29,
      // Accept 128 maximum-width code points without truncation.
      maxPasswordLength: 256,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 3_600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword,
    },
    emailVerification: {
      expiresIn: 3_600,
      sendOnSignIn: true,
      sendOnSignUp: true,
      sendVerificationEmail,
    },
    plugins: [
      haveIBeenPwned({ enabled: true }),
      twoFactor({
        accountLockout: {
          durationSeconds: 900,
          enabled: true,
          maxFailedAttempts: 10,
        },
        allowPasswordless: false,
        issuer: "Quorum Auth V2 Acceptance Spike",
        skipVerificationOnEnable: false,
        twoFactorCookieMaxAge: 600,
      }),
    ],
    rateLimit: {
      enabled: true,
      max: 30,
      storage: "database",
      window: 60,
    },
    secret,
    session: {
      cookieCache: { enabled: false },
      expiresIn: 28_800,
      freshAge: 300,
      updateAge: 900,
    },
    trustedOrigins: [...trustedOrigins],
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation,
        updateEmailWithoutVerification: false,
      },
    },
  };
}
