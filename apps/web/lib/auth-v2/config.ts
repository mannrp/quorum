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
  password: Readonly<{ minLength: 29; maxLength: 128 }>;
  session: Readonly<{
    idleSeconds: 86_400;
    absoluteSeconds: 604_800;
    recentAuthSeconds: 600;
  }>;
  databaseSchema: "better_auth";
  allowImplicitSameEmailLinking: false;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
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

export function parseAuthEnvironment(environment: Environment): AuthRuntimeConfig {
  const secret = required(environment, "BETTER_AUTH_SECRET");
  if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");

  const origin = parseOrigin(
    required(environment, "BETTER_AUTH_URL"),
    environment.NODE_ENV === "production",
  );
  const baseURL = origin.origin;

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
    password: { minLength: 29, maxLength: 128 },
    session: {
      idleSeconds: 86_400,
      absoluteSeconds: 604_800,
      recentAuthSeconds: 600,
    },
    databaseSchema: "better_auth",
    allowImplicitSameEmailLinking: false,
  };
}
