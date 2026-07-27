import { describe, expect, it } from "vitest";

import {
  SESSION_ACCEPTANCE_POLICY,
  assessRefreshContinuity,
  evaluateSessionAt,
} from "./session-acceptance";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

describe("session policy acceptance oracle", () => {
  const session = {
    createdAtMs: 0,
    lastSeenAtMs: 6 * day,
    authenticatedAtMs: 6 * day,
    revoked: false,
  };

  it("centralizes the accepted idle, absolute, and recent-auth limits", () => {
    expect(SESSION_ACCEPTANCE_POLICY).toEqual({
      idleMs: 24 * hour,
      absoluteMs: 7 * day,
      recentAuthenticationMs: 10 * minute,
    });
  });

  it("accepts immediately before each applicable boundary", () => {
    expect(evaluateSessionAt(session, 6 * day + 10 * minute - 1)).toEqual({
      valid: true,
      recent: true,
    });
    expect(evaluateSessionAt(session, 7 * day - 1)).toEqual({
      valid: true,
      recent: false,
    });
  });

  it("expires at the idle and absolute boundaries", () => {
    expect(
      evaluateSessionAt(
        { ...session, createdAtMs: 6 * day, lastSeenAtMs: 6 * day },
        7 * day,
      ),
    ).toEqual({ valid: false, recent: false, reason: "idle-expired" });
    expect(evaluateSessionAt(session, 7 * day)).toEqual({
      valid: false,
      recent: false,
      reason: "absolute-expired",
    });
  });

  it("expires recent authentication at exactly ten minutes", () => {
    expect(evaluateSessionAt(session, 6 * day + 10 * minute)).toEqual({
      valid: true,
      recent: false,
    });
  });

  it("denies revoked and temporally inconsistent sessions", () => {
    expect(evaluateSessionAt({ ...session, revoked: true }, 6 * day)).toEqual({
      valid: false,
      recent: false,
      reason: "revoked",
    });
    expect(evaluateSessionAt(session, -1)).toEqual({
      valid: false,
      recent: false,
      reason: "invalid-timestamps",
    });
  });
});

describe("refresh/rotation context acceptance", () => {
  const before = {
    sessionRecordId: "session-1",
    credentialFingerprint: "fingerprint-before",
    createdAtMs: 1,
    absoluteExpiresAtMs: 101,
    authenticatedAtMs: 2,
    authenticationMethods: ["password"],
    assurance: "aal1",
  };

  it("accepts rotation that preserves real authentication context", () => {
    expect(
      assessRefreshContinuity(before, {
        ...before,
        credentialFingerprint: "fingerprint-after",
      }),
    ).toEqual({ accepted: true });
  });

  it.each([
    ["credentialFingerprint", "fingerprint-before", "credential-not-rotated"],
    ["authenticatedAtMs", 3, "authenticated-at-changed"],
    ["createdAtMs", 3, "creation-time-changed"],
    ["absoluteExpiresAtMs", 102, "absolute-expiry-extended"],
    ["authenticationMethods", ["refresh"], "authentication-methods-changed"],
    ["assurance", "aal2", "assurance-changed"],
  ] as const)("rejects an invalid %s transition", (field, value, reason) => {
    expect(
      assessRefreshContinuity(before, {
        ...before,
        credentialFingerprint: "fingerprint-after",
        [field]: value,
      }),
    ).toEqual({ accepted: false, reason });
  });

  it("rejects missing authentication context", () => {
    expect(
      assessRefreshContinuity(
        { ...before, authenticationMethods: [] },
        {
          ...before,
          credentialFingerprint: "fingerprint-after",
          authenticationMethods: [],
        },
      ),
    ).toEqual({ accepted: false, reason: "authentication-context-missing" });
  });

  it("rejects incomplete or temporally invalid evidence", () => {
    expect(
      assessRefreshContinuity(
        { ...before, credentialFingerprint: "" },
        { ...before, credentialFingerprint: "fingerprint-after" },
      ),
    ).toEqual({ accepted: false, reason: "invalid-refresh-evidence" });
    expect(
      assessRefreshContinuity(before, {
        ...before,
        credentialFingerprint: "fingerprint-after",
        absoluteExpiresAtMs: Number.NaN,
      }),
    ).toEqual({ accepted: false, reason: "invalid-refresh-evidence" });
  });
});
