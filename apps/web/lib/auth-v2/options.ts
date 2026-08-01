import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
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

type AuthenticationContext = Readonly<{
  path?: string;
  params?: Readonly<Record<string, string | undefined>>;
}>;

export function resolveAuthenticationMethods(context: AuthenticationContext): string {
  if (context.path === "/sign-in/email" || context.path === "/sign-up/email") {
    return '["password"]';
  }

  const provider = context.params?.id ?? context.params?.providerId;
  if (provider === "google" || provider === "quorum-test-oidc") {
    return '["google"]';
  }

  throw new Error("Unsupported session authentication method");
}
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
    onAPIError: { errorURL: "/auth/login?oauth=error" },
    plugins: config.testOIDC ? [genericOAuth({
      config: [{
        providerId: "quorum-test-oidc",
        authorizationUrl: `${config.testOIDC.baseURL}/authorize`,
        tokenUrl: `${config.testOIDC.baseURL}/token`,
        userInfoUrl: `${config.testOIDC.baseURL}/userinfo`,
        issuer: config.testOIDC.baseURL,
        requireIssuerValidation: true,
        clientId: config.testOIDC.clientId,
        clientSecret: config.testOIDC.clientSecret,
        scopes: ["openid", "email", "profile"],
        pkce: true,
        authentication: "post",
      }],
    })] : [],
    socialProviders: config.google ? {
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        redirectURI: config.google.callbackURL,
        scope: ["openid", "email", "profile"],
        accessType: "online",
        ...(config.testOIDC ? {
          verifyIdToken: async (token: string) => token === "quorum-test-google-link-token",
          getUserInfo: async () => ({
            user: {
              id: "deterministic-google-link-subject",
              email: "oidc-link@example.test",
              emailVerified: true,
              name: "OIDC Link User",
            },
            data: {},
          }),
        } : {}),
      },
    } : undefined,
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
          before: async (session, context) => {
            const now = new Date();
            return {
              data: {
                ...session,
                absoluteExpiresAt: new Date(now.getTime() + config.session.absoluteSeconds * 1_000),
                assurance: "aal1",
                authenticatedAt: now,
                authenticationMethods: resolveAuthenticationMethods(context ?? {}),
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
