import { describe, expect, it } from "vitest";

import { assessBetterAuthSession } from "./better-auth-session-policy";

const minute = 60_000;
const day = 24 * 60 * minute;
const base = {
  absoluteExpiresAt: new Date(7 * day),
  assurance: "aal1",
  authenticatedAt: new Date(0),
  authenticationMethods: '["password"]',
  expiresAt: new Date(day),
  lastSeenAt: new Date(0),
};

describe("Better Auth Quorum BFF session policy", () => {
  it("accepts before boundaries and preserves authentication context", () => {
    expect(assessBetterAuthSession(base, new Date(10 * minute - 1))).toEqual({
      allowed: true,
      assurance: "aal1",
      authenticationMethods: ["password"],
      recent: true,
    });
  });

  it("expires recent auth, idle, and absolute access at exact boundaries", () => {
    expect(assessBetterAuthSession(base, new Date(10 * minute))).toMatchObject({
      allowed: true,
      recent: false,
    });
    expect(assessBetterAuthSession(base, new Date(day))).toEqual({
      allowed: false,
      reason: "idle-expired",
    });
    expect(
      assessBetterAuthSession(
        { ...base, expiresAt: new Date(8 * day) },
        new Date(7 * day),
      ),
    ).toEqual({ allowed: false, reason: "absolute-expired" });
  });

  it("fails closed on missing, malformed, or contradictory context", () => {
    expect(
      assessBetterAuthSession(
        { ...base, authenticationMethods: "not-json" },
        new Date(1),
      ),
    ).toEqual({ allowed: false, reason: "authentication-context-invalid" });
    expect(
      assessBetterAuthSession(
        { ...base, assurance: "", authenticationMethods: "[]" },
        new Date(1),
      ),
    ).toEqual({ allowed: false, reason: "authentication-context-invalid" });
    expect(
      assessBetterAuthSession(
        { ...base, authenticatedAt: new Date(2) },
        new Date(1),
      ),
    ).toEqual({ allowed: false, reason: "timestamps-invalid" });
  });
});
