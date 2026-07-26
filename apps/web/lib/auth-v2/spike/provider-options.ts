import type { BetterAuthOptions } from "better-auth";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";

import type { AuthProviderSpikeRuntimeConfig } from "./runtime-config";

type EmailVerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>;
type EmailPasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>;
type ChangeEmailOptions = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["changeEmail"]
>;

type AuthProviderSpikeOptionInputs = Readonly<{
  database: NonNullable<BetterAuthOptions["database"]>;
  runtime: AuthProviderSpikeRuntimeConfig;
  sendChangeEmailConfirmation: NonNullable<
    ChangeEmailOptions["sendChangeEmailConfirmation"]
  >;
  sendResetPassword: NonNullable<EmailPasswordOptions["sendResetPassword"]>;
  sendVerificationEmail: NonNullable<
    EmailVerificationOptions["sendVerificationEmail"]
  >;
}>;

export function buildAuthProviderSpikeOptions({
  database,
  runtime,
  sendChangeEmailConfirmation,
  sendResetPassword,
  sendVerificationEmail,
}: AuthProviderSpikeOptionInputs): BetterAuthOptions {
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
    baseURL: runtime.baseURL,
    database,
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 15,
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
    secret: runtime.secret,
    session: {
      cookieCache: { enabled: false },
      expiresIn: 28_800,
      freshAge: 300,
      updateAge: 900,
    },
    trustedOrigins: [...runtime.trustedOrigins],
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation,
        updateEmailWithoutVerification: false,
      },
    },
  };
}
