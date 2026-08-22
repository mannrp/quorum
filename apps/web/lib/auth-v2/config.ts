import "server-only";

export type AuthRuntimeConfig = Readonly<{
  baseURL: string;
  databaseURL: string;
  secret: string;
  trustedOrigins: readonly [string];
  cookie: Readonly<{
    secure: boolean;
    httpOnly: true;
    sameSite: "lax";
  }>;
  password: Readonly<{ minLength: 8; maxLength: 128 }>;
  requireEmailVerification: boolean;
  session: Readonly<{
    idleSeconds: 86_400;
    absoluteSeconds: 604_800;
    recentAuthSeconds: 600;
  }>;
  databaseSchema: "better_auth";
  allowImplicitSameEmailLinking: false;
  testOIDC?: Readonly<{
    baseURL: string;
    clientId: string;
    clientSecret: string;
  }>;
  google?: Readonly<{
    clientId: string;
    clientSecret: string;
    callbackURL: string;
  }>;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalBoolean(environment: Environment, name: string, fallback: boolean): boolean {
  const value = environment[name]?.trim();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}
function parseOrigin(raw: string, production: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute origin.");
  }

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("BETTER_AUTH_URL must contain only scheme, host, and optional port.");
  }

  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && (production || url.protocol !== "http:" || !loopback)) {
    throw new Error("BETTER_AUTH_URL must use HTTPS except for a development loopback origin.");
  }

  return url;
}

function parseDatabaseURL(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("AUTH_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("AUTH_DATABASE_URL must use PostgreSQL.");
  }
  return raw;
}

function parseTestOIDC(environment: Environment, production: boolean): AuthRuntimeConfig["testOIDC"] {
  const baseURL = environment.AUTH_TEST_OIDC_BASE_URL?.trim() ?? "";
  const clientId = environment.AUTH_TEST_OIDC_CLIENT_ID?.trim() ?? "";
  const clientSecret = environment.AUTH_TEST_OIDC_CLIENT_SECRET?.trim() ?? "";
  if (!baseURL && !clientId && !clientSecret) return undefined;
  if (production) throw new Error("The deterministic OIDC provider is nonproduction only.");
  if (!baseURL || !clientId || !clientSecret) throw new Error("The deterministic OIDC provider requires complete configuration.");
  const url = parseOrigin(baseURL, false);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "http:" || !loopback) throw new Error("The deterministic OIDC provider must use an HTTP loopback origin.");
  return { baseURL: url.origin, clientId, clientSecret };
}

function parseGoogle(environment: Environment, baseURL: string): AuthRuntimeConfig["google"] {
  const clientId = environment.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error("Google credentials must provide both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  if (!clientId) return undefined;
  return {
    clientId,
    clientSecret,
    callbackURL: `${baseURL}/api/auth/callback/google`,
  };
}

export function parseAuthEnvironment(environment: Environment): AuthRuntimeConfig {
  const secret = required(environment, "BETTER_AUTH_SECRET");
  if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");

  const origin = parseOrigin(
    required(environment, "BETTER_AUTH_URL"),
    environment.NODE_ENV === "production",
  );
  const baseURL = origin.origin;
  const google = parseGoogle(environment, baseURL);
  const testOIDC = parseTestOIDC(environment, environment.NODE_ENV === "production");
  const requireEmailVerification = optionalBoolean(environment, "AUTH_REQUIRE_EMAIL_VERIFICATION", true);
  if (environment.NODE_ENV === "production" && !requireEmailVerification) {
    throw new Error("Email verification cannot be disabled in production.");
  }

  return {
    baseURL,
    databaseURL: parseDatabaseURL(required(environment, "AUTH_DATABASE_URL")),
    secret,
    trustedOrigins: [baseURL],
    cookie: {
      secure: origin.protocol === "https:",
      httpOnly: true,
      sameSite: "lax",
    },
    password: { minLength: 8, maxLength: 128 },
    requireEmailVerification,
    session: {
      idleSeconds: 86_400,
      absoluteSeconds: 604_800,
      recentAuthSeconds: 600,
    },
    databaseSchema: "better_auth",
    allowImplicitSameEmailLinking: false,
    ...(google ? { google } : {}),
    ...(testOIDC ? { testOIDC } : {}),
  };
}
