const MFA_CAPABILITIES = [
  "enrollment",
  "stepUp",
  "assuranceContext",
  "replayDenied",
  "rateLimited",
  "factorList",
  "factorAdd",
  "factorRemove",
  "factorChange",
  "recovery",
  "sessionRevocation",
  "outageFailsClosed",
] as const;

type MfaCapability = (typeof MFA_CAPABILITIES)[number];
export type MfaCapabilityEvidence = Readonly<Record<MfaCapability, boolean>>;

// Capability evidence must come from maintained provider/plugin behavior. This
// checklist never implements factor generation, verification, or recovery.
export function assessMfaCapability(
  evidence: MfaCapabilityEvidence,
): { accepted: true } | { accepted: false; missing: MfaCapability[] } {
  const missing = MFA_CAPABILITIES.filter((capability) => !evidence[capability]);
  return missing.length === 0
    ? { accepted: true }
    : { accepted: false, missing };
}

type TransactionalEventEvidence = Readonly<{
  mode: "transactional";
  committedEventPersisted: boolean;
  rolledBackEventAbsent: boolean;
}>;

const RECONCILIATION_PROPERTIES = [
  "droppedEventDetected",
  "repaired",
  "versioned",
  "staleGrantPrevented",
  "duplicateIdempotent",
  "reorderedConverges",
  "poisonIsolated",
] as const;

type ReconciliationProperty = (typeof RECONCILIATION_PROPERTIES)[number];
type ReconciliationEvidence = Readonly<
  { mode: "reconciliation" } & Record<ReconciliationProperty, boolean>
>;

export function assessAuthEventReliability(
  evidence: TransactionalEventEvidence | ReconciliationEvidence,
):
  | { accepted: true; mode: "transactional" | "reconciliation" }
  | {
      accepted: false;
      reason: "committed-event-missing" | "rollback-leaked-event";
    }
  | { accepted: false; missing: ReconciliationProperty[] } {
  if (evidence.mode === "transactional") {
    if (!evidence.committedEventPersisted) {
      return { accepted: false, reason: "committed-event-missing" };
    }
    if (!evidence.rolledBackEventAbsent) {
      return { accepted: false, reason: "rollback-leaked-event" };
    }
    return { accepted: true, mode: "transactional" };
  }

  const missing = RECONCILIATION_PROPERTIES.filter(
    (property) => !evidence[property],
  );
  return missing.length === 0
    ? { accepted: true, mode: "reconciliation" }
    : { accepted: false, missing };
}

export type PerformanceSample = Readonly<{
  queryCount: number;
  latencyMs: number;
}>;

type NumericSummary = Readonly<{
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}>;

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.ceil(fraction * sorted.length) - 1] as number;
}

function summarizeNumbers(values: readonly number[]): NumericSummary {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0] as number,
    max: sorted.at(-1) as number,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

// Only aggregate numbers are returned, keeping request bodies, identifiers, and
// credentials out of performance evidence.
export function summarizePerformance(samples: readonly PerformanceSample[]): {
  samples: number;
  queryCount: NumericSummary;
  latencyMs: NumericSummary;
} {
  if (
    samples.length === 0 ||
    samples.some(
      ({ queryCount, latencyMs }) =>
        !Number.isInteger(queryCount) ||
        queryCount < 0 ||
        !Number.isFinite(latencyMs) ||
        latencyMs < 0,
    )
  ) {
    throw new Error("Valid nonempty performance samples are required");
  }

  return {
    samples: samples.length,
    queryCount: summarizeNumbers(samples.map(({ queryCount }) => queryCount)),
    latencyMs: summarizeNumbers(samples.map(({ latencyMs }) => latencyMs)),
  };
}
