import { describe, expect, it } from "vitest";

import {
  assessAuthEventReliability,
  assessMfaCapability,
  summarizePerformance,
} from "./capability-acceptance";

describe("future Admin MFA provider capability", () => {
  const complete = {
    enrollment: true,
    stepUp: true,
    assuranceContext: true,
    replayDenied: true,
    rateLimited: true,
    factorList: true,
    factorAdd: true,
    factorRemove: true,
    factorChange: true,
    recovery: true,
    sessionRevocation: true,
    outageFailsClosed: true,
  } as const;

  it("accepts only the complete maintained-provider lifecycle", () => {
    expect(assessMfaCapability(complete)).toEqual({ accepted: true });
  });

  it.each(Object.keys(complete) as (keyof typeof complete)[])(
    "rejects missing %s capability",
    (capability) => {
      expect(
        assessMfaCapability({ ...complete, [capability]: false }),
      ).toEqual({ accepted: false, missing: [capability] });
    },
  );
});

describe("auth-event reliability acceptance", () => {
  it("accepts transactional event coupling with rollback control", () => {
    expect(
      assessAuthEventReliability({
        mode: "transactional",
        committedEventPersisted: true,
        rolledBackEventAbsent: true,
      }),
    ).toEqual({ accepted: true, mode: "transactional" });
  });

  it("rejects transactional coupling without a rollback control", () => {
    expect(
      assessAuthEventReliability({
        mode: "transactional",
        committedEventPersisted: true,
        rolledBackEventAbsent: false,
      }),
    ).toEqual({ accepted: false, reason: "rollback-leaked-event" });
  });

  it("accepts a complete versioned reconciliation fallback", () => {
    expect(
      assessAuthEventReliability({
        mode: "reconciliation",
        droppedEventDetected: true,
        repaired: true,
        versioned: true,
        staleGrantPrevented: true,
        duplicateIdempotent: true,
        reorderedConverges: true,
        poisonIsolated: true,
      }),
    ).toEqual({ accepted: true, mode: "reconciliation" });
  });

  it("reports every missing reconciliation property without accepting", () => {
    expect(
      assessAuthEventReliability({
        mode: "reconciliation",
        droppedEventDetected: false,
        repaired: false,
        versioned: true,
        staleGrantPrevented: false,
        duplicateIdempotent: true,
        reorderedConverges: true,
        poisonIsolated: false,
      }),
    ).toEqual({
      accepted: false,
      missing: [
        "droppedEventDetected",
        "repaired",
        "staleGrantPrevented",
        "poisonIsolated",
      ],
    });
  });
});

describe("sanitized performance evidence", () => {
  it("summarizes query counts and latency without request data", () => {
    expect(
      summarizePerformance([
        { queryCount: 3, latencyMs: 10 },
        { queryCount: 2, latencyMs: 5 },
        { queryCount: 4, latencyMs: 20 },
        { queryCount: 3, latencyMs: 15 },
      ]),
    ).toEqual({
      samples: 4,
      queryCount: { min: 2, max: 4, p50: 3, p95: 4, p99: 4 },
      latencyMs: { min: 5, max: 20, p50: 10, p95: 20, p99: 20 },
    });
  });

  it.each([
    { samples: [] },
    { samples: [{ queryCount: -1, latencyMs: 1 }] },
    { samples: [{ queryCount: 1.5, latencyMs: 1 }] },
    {
      samples: [{ queryCount: 1, latencyMs: Number.POSITIVE_INFINITY }],
    },
  ])("rejects missing or invalid samples", ({ samples }) => {
    expect(() => summarizePerformance(samples)).toThrow(
      "performance samples",
    );
  });
});
