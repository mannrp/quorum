const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Test oracle only. The accepted provider must enforce these values; this module
// must not become an independent production session implementation.
export const SESSION_ACCEPTANCE_POLICY = Object.freeze({
  idleMs: 24 * HOUR_MS,
  absoluteMs: 7 * DAY_MS,
  recentAuthenticationMs: 10 * MINUTE_MS,
});

export type SessionTimeline = Readonly<{
  createdAtMs: number;
  lastSeenAtMs: number;
  authenticatedAtMs: number;
  revoked: boolean;
}>;

export type SessionEvaluation =
  | { valid: true; recent: boolean }
  | {
      valid: false;
      recent: false;
      reason:
        | "revoked"
        | "invalid-timestamps"
        | "absolute-expired"
        | "idle-expired";
    };

export function evaluateSessionAt(
  session: SessionTimeline,
  nowMs: number,
): SessionEvaluation {
  if (session.revoked) {
    return { valid: false, recent: false, reason: "revoked" };
  }
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(session.createdAtMs) ||
    !Number.isFinite(session.lastSeenAtMs) ||
    !Number.isFinite(session.authenticatedAtMs) ||
    nowMs < session.createdAtMs ||
    nowMs < session.lastSeenAtMs ||
    nowMs < session.authenticatedAtMs ||
    session.lastSeenAtMs < session.createdAtMs ||
    session.authenticatedAtMs < session.createdAtMs
  ) {
    return { valid: false, recent: false, reason: "invalid-timestamps" };
  }
  if (nowMs - session.createdAtMs >= SESSION_ACCEPTANCE_POLICY.absoluteMs) {
    return { valid: false, recent: false, reason: "absolute-expired" };
  }
  if (nowMs - session.lastSeenAtMs >= SESSION_ACCEPTANCE_POLICY.idleMs) {
    return { valid: false, recent: false, reason: "idle-expired" };
  }

  return {
    valid: true,
    recent:
      nowMs - session.authenticatedAtMs <
      SESSION_ACCEPTANCE_POLICY.recentAuthenticationMs,
  };
}

export type RefreshContext = Readonly<{
  sessionRecordId: string;
  // The acceptance driver supplies a one-way test fingerprint so evidence never
  // contains the reusable credential itself.
  credentialFingerprint: string;
  createdAtMs: number;
  absoluteExpiresAtMs: number;
  authenticatedAtMs: number;
  authenticationMethods: readonly string[];
  assurance: string;
}>;

type RefreshRejectionReason =
  | "credential-not-rotated"
  | "authenticated-at-changed"
  | "creation-time-changed"
  | "absolute-expiry-extended"
  | "authentication-methods-changed"
  | "assurance-changed";

export type RefreshContinuityAssessment =
  | { accepted: true }
  | { accepted: false; reason: RefreshRejectionReason };

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === new Set(right).size &&
    [...new Set(left)].every((value) => new Set(right).has(value))
  );
}

export function assessRefreshContinuity(
  before: RefreshContext,
  after: RefreshContext,
): RefreshContinuityAssessment {
  if (before.credentialFingerprint === after.credentialFingerprint) {
    return { accepted: false, reason: "credential-not-rotated" };
  }
  if (before.authenticatedAtMs !== after.authenticatedAtMs) {
    return { accepted: false, reason: "authenticated-at-changed" };
  }
  if (before.createdAtMs !== after.createdAtMs) {
    return { accepted: false, reason: "creation-time-changed" };
  }
  if (before.absoluteExpiresAtMs !== after.absoluteExpiresAtMs) {
    return { accepted: false, reason: "absolute-expiry-extended" };
  }
  if (
    !sameStringSet(
      before.authenticationMethods,
      after.authenticationMethods,
    )
  ) {
    return { accepted: false, reason: "authentication-methods-changed" };
  }
  if (before.assurance !== after.assurance) {
    return { accepted: false, reason: "assurance-changed" };
  }

  return { accepted: true };
}
