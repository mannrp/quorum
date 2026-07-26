import { isAuthProviderSpikeEnabled } from "./boundary";

const SPIKE_SEARCH_PATH = "better_auth,pg_catalog,pg_temp";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

type AuthProviderSpikeRuntimeEnvironment = Readonly<{
  AUTH_PROVIDER_SPIKE_DATABASE_URL?: string;
  AUTH_PROVIDER_SPIKE_ENABLED?: string;
  AUTH_PROVIDER_SPIKE_ORIGIN?: string;
  AUTH_PROVIDER_SPIKE_SECRET?: string;
  NODE_ENV?: string;
}>;

export type AuthProviderSpikeRuntimeConfig = Readonly<{
  baseURL: string;
  databaseURL: string;
  postgresOptions: string;
  secret: string;
  trustedOrigins: readonly string[];
}>;

function parseLoopbackURL(
  rawURL: string | undefined,
  allowedProtocols: ReadonlySet<string>,
  name: string,
): URL {
  if (!rawURL) {
    throw new Error(`${name} is required for the auth-provider spike.`);
  }

  const parsed = new URL(rawURL);
  if (!allowedProtocols.has(parsed.protocol) || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${name} must use an allowed protocol on a loopback host.`);
  }

  return parsed;
}

export function getAuthProviderSpikeRuntimeConfig(
  environment: AuthProviderSpikeRuntimeEnvironment,
): AuthProviderSpikeRuntimeConfig {
  if (!isAuthProviderSpikeEnabled(environment)) {
    throw new Error("The auth-provider spike is disabled outside explicit development/test use.");
  }

  const secret = environment.AUTH_PROVIDER_SPIKE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_PROVIDER_SPIKE_SECRET must contain at least 32 characters.");
  }

  const origin = parseLoopbackURL(
    environment.AUTH_PROVIDER_SPIKE_ORIGIN,
    new Set(["http:", "https:"]),
    "AUTH_PROVIDER_SPIKE_ORIGIN",
  );
  if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error("AUTH_PROVIDER_SPIKE_ORIGIN must be an origin without credentials, path, query, or fragment.");
  }

  const database = parseLoopbackURL(
    environment.AUTH_PROVIDER_SPIKE_DATABASE_URL,
    new Set(["postgres:", "postgresql:"]),
    "AUTH_PROVIDER_SPIKE_DATABASE_URL",
  );

  return {
    baseURL: new URL("/api/auth-v2-spike", origin).toString().replace(/\/$/, ""),
    databaseURL: database.toString(),
    postgresOptions: `-c search_path=${SPIKE_SEARCH_PATH}`,
    secret,
    trustedOrigins: [origin.origin],
  };
}
