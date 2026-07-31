export type BetterAuthSessionPolicyRecord = Readonly<{
  absoluteExpiresAt: Date;
  assurance: string;
  authenticatedAt: Date;
  authenticationMethods: string;
  expiresAt: Date;
  lastSeenAt: Date;
}>;

export type BetterAuthSessionPolicyDecision =
  | Readonly<{
      allowed: true;
      assurance: string;
      authenticationMethods: readonly string[];
      recent: boolean;
    }>
  | Readonly<{
      allowed: false;
      reason:
        | "absolute-expired"
        | "authentication-context-invalid"
        | "idle-expired"
        | "timestamps-invalid";
    }>;

const RECENT_AUTHENTICATION_MS = 10 * 60 * 1_000;

// This is a candidate BFF policy adapter, not a session implementation. Better
// Auth remains responsible for credential issuance, lookup, rotation, and
// revocation; the adapter fails closed on Quorum's independent absolute cap.
export function assessBetterAuthSession(
  session: BetterAuthSessionPolicyRecord,
  now: Date,
): BetterAuthSessionPolicyDecision {
  const timestamps = [
    now,
    session.absoluteExpiresAt,
    session.authenticatedAt,
    session.expiresAt,
    session.lastSeenAt,
  ];
  if (timestamps.some((value) => !(value instanceof Date) || !Number.isFinite(value.getTime()))) {
    return { allowed: false, reason: "timestamps-invalid" };
  }
  if (now >= session.absoluteExpiresAt) {
    return { allowed: false, reason: "absolute-expired" };
  }
  if (now >= session.expiresAt) {
    return { allowed: false, reason: "idle-expired" };
  }
  if (
    session.authenticatedAt > now ||
    session.lastSeenAt > now ||
    session.authenticatedAt > session.absoluteExpiresAt ||
    session.lastSeenAt > session.absoluteExpiresAt
  ) {
    return { allowed: false, reason: "timestamps-invalid" };
  }

  let methods: unknown;
  try {
    methods = JSON.parse(session.authenticationMethods);
  } catch {
    return { allowed: false, reason: "authentication-context-invalid" };
  }
  if (
    !Array.isArray(methods) ||
    methods.length === 0 ||
    methods.some((method) => typeof method !== "string" || method.length === 0) ||
    session.assurance.length === 0
  ) {
    return { allowed: false, reason: "authentication-context-invalid" };
  }

  return {
    allowed: true,
    assurance: session.assurance,
    authenticationMethods: methods,
    recent:
      now.getTime() - session.authenticatedAt.getTime() <
      RECENT_AUTHENTICATION_MS,
  };
}
