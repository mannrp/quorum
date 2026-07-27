export const AUTH_SPIKE_ROUTE_ALLOWLIST = [
  {
    method: "POST",
    path: "/api/auth-v2/spike/sign-in",
    purpose: "create-session",
  },
  {
    method: "POST",
    path: "/api/auth-v2/spike/sign-out",
    purpose: "revoke-current-session",
  },
  {
    method: "GET",
    path: "/api/auth-v2/spike/sessions",
    purpose: "list-sessions",
  },
] as const;

type AllowedRoute = (typeof AUTH_SPIKE_ROUTE_ALLOWLIST)[number];

export type SpikeRouteAuthorization =
  | { allowed: true; purpose: AllowedRoute["purpose"] }
  | { allowed: false; status: 404 | 405 };

export function authorizeSpikeRoute(
  method: string,
  path: string,
): SpikeRouteAuthorization {
  const routesForPath = AUTH_SPIKE_ROUTE_ALLOWLIST.filter(
    (route) => route.path === path,
  );

  if (routesForPath.length === 0) {
    return { allowed: false, status: 404 };
  }

  const route = routesForPath.find((candidate) => candidate.method === method);
  return route
    ? { allowed: true, purpose: route.purpose }
    : { allowed: false, status: 405 };
}

const TOP_LEVEL_SAFE_FIELDS = new Set(["ok", "count", "next"]);
const USER_SAFE_FIELDS = new Set(["id", "email", "emailVerified", "name", "image"]);
const SESSION_SAFE_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "current",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function projectFields(
  value: unknown,
  allowedFields: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => allowedFields.has(key)),
  );
}

export function projectCredentialSafeJson(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const projected = Object.fromEntries(
    Object.entries(value).filter(([key]) => TOP_LEVEL_SAFE_FIELDS.has(key)),
  );
  const user = projectFields(value.user, USER_SAFE_FIELDS);
  const session = projectFields(value.session, SESSION_SAFE_FIELDS);

  if (user) projected.user = user;
  if (session) projected.session = session;

  if (Array.isArray(value.sessions)) {
    projected.sessions = value.sessions
      .map((candidate) => projectFields(candidate, SESSION_SAFE_FIELDS))
      .filter((candidate) => candidate !== undefined);
  }

  return projected;
}
