export type RateLimitTraceEvent = Readonly<{
  instance: string;
  store: string;
  outcome: "allowed" | "denied-limit" | "denied-outage";
}>;

type RateLimitRejection =
  | "invalid-limit"
  | "single-instance-only"
  | "missing-outage-control"
  | "outage-failed-open"
  | "store-not-shared"
  | "two-instance-limit-not-proven"
  | "missing-limit-control"
  | "limit-triggered-early"
  | "limit-failed-open";

// This validates an observed provider trace. It is not a rate limiter.
export function assessRateLimitTrace(
  trace: readonly RateLimitTraceEvent[],
  allowedAttempts: number,
): { accepted: true } | { accepted: false; reason: RateLimitRejection } {
  if (!Number.isInteger(allowedAttempts) || allowedAttempts <= 0) {
    return { accepted: false, reason: "invalid-limit" };
  }
  if (new Set(trace.map(({ instance }) => instance)).size < 2) {
    return { accepted: false, reason: "single-instance-only" };
  }

  const outageEvents = trace.filter(({ store }) => store === "unavailable");
  if (outageEvents.length === 0) {
    return { accepted: false, reason: "missing-outage-control" };
  }
  if (outageEvents.some(({ outcome }) => outcome !== "denied-outage")) {
    return { accepted: false, reason: "outage-failed-open" };
  }

  const availableEvents = trace.filter(({ store }) => store !== "unavailable");
  if (new Set(availableEvents.map(({ store }) => store)).size !== 1) {
    return { accepted: false, reason: "store-not-shared" };
  }
  if (new Set(availableEvents.map(({ instance }) => instance)).size < 2) {
    return { accepted: false, reason: "two-instance-limit-not-proven" };
  }
  if (!availableEvents.some(({ outcome }) => outcome === "denied-limit")) {
    return { accepted: false, reason: "missing-limit-control" };
  }
  if (
    availableEvents.filter(({ outcome }) => outcome === "allowed").length >
    allowedAttempts
  ) {
    return { accepted: false, reason: "limit-failed-open" };
  }

  const firstLimitDenial = availableEvents.findIndex(
    ({ outcome }) => outcome === "denied-limit",
  );
  if (
    availableEvents
      .slice(0, firstLimitDenial)
      .filter(({ outcome }) => outcome === "allowed").length !== allowedAttempts
  ) {
    return { accepted: false, reason: "limit-triggered-early" };
  }
  if (
    availableEvents
      .slice(firstLimitDenial + 1)
      .some(({ outcome }) => outcome === "allowed")
  ) {
    return { accepted: false, reason: "limit-failed-open" };
  }

  return { accepted: true };
}

type LinkedMethod = Readonly<{
  provider: string;
  providerSubject: string;
  authUserId: string;
}>;

export type IdentityLinkingTrace = Readonly<{
  explicitLink: Readonly<{
    recentlyAuthenticated: boolean;
    newProviderControlProven: boolean;
  }>;
  linkedMethods: readonly LinkedMethod[];
  sameEmailCollision: Readonly<{
    firstAuthUserId: string;
    secondAuthUserId: string;
    linkedAutomatically: boolean;
  }>;
  unlink: Readonly<{
    methodsBefore: number;
    methodsAfter: number;
  }>;
}>;

type IdentityLinkingRejection =
  | "recent-auth-missing"
  | "provider-control-missing"
  | "linked-methods-incomplete"
  | "invalid-stable-identifier"
  | "duplicate-provider-method"
  | "linked-methods-split-identity"
  | "collision-not-isolated"
  | "same-email-auto-linked"
  | "unlink-removes-last-method"
  | "unlink-count-mismatch"
  | "invalid-unlink-transition";

// This validates stable provider identifiers only; editable email is deliberately
// absent from the trace shape and therefore cannot become linking authority.
export function assessIdentityLinkingTrace(
  trace: IdentityLinkingTrace,
): { accepted: true } | { accepted: false; reason: IdentityLinkingRejection } {
  if (!trace.explicitLink.recentlyAuthenticated) {
    return { accepted: false, reason: "recent-auth-missing" };
  }
  if (!trace.explicitLink.newProviderControlProven) {
    return { accepted: false, reason: "provider-control-missing" };
  }
  if (trace.linkedMethods.length < 2) {
    return { accepted: false, reason: "linked-methods-incomplete" };
  }
  if (
    trace.linkedMethods.some(
      ({ provider, providerSubject, authUserId }) =>
        provider.length === 0 || providerSubject.length === 0 || authUserId.length === 0,
    )
  ) {
    return { accepted: false, reason: "invalid-stable-identifier" };
  }
  if (
    new Set(
      trace.linkedMethods.map(
        ({ provider, providerSubject }) => `${provider}\u0000${providerSubject}`,
      ),
    ).size !== trace.linkedMethods.length
  ) {
    return { accepted: false, reason: "duplicate-provider-method" };
  }
  if (new Set(trace.linkedMethods.map(({ authUserId }) => authUserId)).size !== 1) {
    return { accepted: false, reason: "linked-methods-split-identity" };
  }
  if (
    trace.sameEmailCollision.firstAuthUserId ===
    trace.sameEmailCollision.secondAuthUserId
  ) {
    return { accepted: false, reason: "collision-not-isolated" };
  }
  if (trace.sameEmailCollision.linkedAutomatically) {
    return { accepted: false, reason: "same-email-auto-linked" };
  }
  if (trace.unlink.methodsAfter < 1) {
    return { accepted: false, reason: "unlink-removes-last-method" };
  }
  if (trace.unlink.methodsBefore !== trace.linkedMethods.length) {
    return { accepted: false, reason: "unlink-count-mismatch" };
  }
  if (
    !Number.isInteger(trace.unlink.methodsBefore) ||
    !Number.isInteger(trace.unlink.methodsAfter) ||
    trace.unlink.methodsBefore - trace.unlink.methodsAfter !== 1
  ) {
    return { accepted: false, reason: "invalid-unlink-transition" };
  }

  return { accepted: true };
}
