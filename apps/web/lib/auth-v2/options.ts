import "server-only";
import type { BetterAuthOptions } from "better-auth";
import type { AuthRuntimeConfig } from "./config";

type EmailVerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>;
type EmailPasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>;
type ChangeEmailOptions = NonNullable<NonNullable<BetterAuthOptions["user"]>["changeEmail"]>;

type Inputs = Readonly<{
  config: AuthRuntimeConfig;
  database: NonNullable<BetterAuthOptions["database"]>;
  sendChangeEmailConfirmation: NonNullable<ChangeEmailOptions["sendChangeEmailConfirmation"]>;
  sendResetPassword: NonNullable<EmailPasswordOptions["sendResetPassword"]>;
  sendVerificationEmail: NonNullable<EmailVerificationOptions["sendVerificationEmail"]>;
}>;

export function buildBetterAuthOptions({
  config,
  database,
  sendChangeEmailConfirmation,
  sendResetPassword,
  sendVerificationEmail,
}: Inputs): BetterAuthOptions {
  return {
    appName: "Quorum",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [...config.trustedOrigins],
    database,
    advanced: {
      cookiePrefix: "quorum",
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: config.cookie.httpOnly,
        sameSite: config.cookie.sameSite,
        secure: config.cookie.secure,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: config.cookie.secure,
    },
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: !config.allowImplicitSameEmailLinking,
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        requireLocalEmailVerified: true,
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: config.password.minLength,
      maxPasswordLength: config.password.maxLength,
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
    rateLimit: {
      enabled: true,
      max: 30,
      storage: "database",
      window: 60,
    },
    session: {
      cookieCache: { enabled: false },
      expiresIn: config.session.idleSeconds,
      freshAge: config.session.recentAuthSeconds,
      updateAge: 900,
      additionalFields: {
        absoluteExpiresAt: { input: false, required: true, type: "date" },
        assurance: { input: false, required: true, type: "string" },
        authenticatedAt: { input: false, required: true, type: "date" },
        authenticationMethods: { input: false, required: true, type: "string" },
        lastSeenAt: { input: false, required: true, type: "date" },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const now = new Date();
            return {
              data: {
                ...session,
                absoluteExpiresAt: new Date(now.getTime() + config.session.absoluteSeconds * 1_000),
                assurance: "aal1",
                authenticatedAt: now,
                authenticationMethods: '["password"]',
                lastSeenAt: now,
              },
            };
          },
        },
        update: {
          before: async (session) => ({
            data: { ...session, lastSeenAt: new Date() },
          }),
        },
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation,
        updateEmailWithoutVerification: false,
      },
    },
  };
}
