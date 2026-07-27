import { describe, expect, it } from "vitest";

import {
  assessMutationOrigin,
  assessSessionCookie,
} from "./browser-security";

describe("state-changing request origin policy", () => {
  const expectedOrigin = "https://quorum.example.test";

  it("accepts only an exact trusted origin", () => {
    expect(
      assessMutationOrigin(
        { origin: expectedOrigin, secFetchSite: "same-origin" },
        expectedOrigin,
      ),
    ).toEqual({ allowed: true });
  });

  it.each([
    {
      name: "missing origin",
      request: { origin: undefined, secFetchSite: "same-origin" },
      reason: "missing-origin",
    },
    {
      name: "wrong origin",
      request: {
        origin: "https://attacker.example.test",
        secFetchSite: "cross-site",
      },
      reason: "origin-mismatch",
    },
    {
      name: "lookalike origin",
      request: {
        origin: "https://quorum.example.test.attacker.test",
        secFetchSite: "cross-site",
      },
      reason: "origin-mismatch",
    },
    {
      name: "malformed origin",
      request: { origin: "not a URL", secFetchSite: "same-origin" },
      reason: "invalid-origin",
    },
    {
      name: "cross-site browser context",
      request: { origin: expectedOrigin, secFetchSite: "cross-site" },
      reason: "cross-site",
    },
  ])("rejects $name", ({ request, reason }) => {
    expect(assessMutationOrigin(request, expectedOrigin)).toEqual({
      allowed: false,
      reason,
    });
  });

  it("fails closed when the configured origin is not canonical", () => {
    expect(
      assessMutationOrigin(
        { origin: expectedOrigin, secFetchSite: "same-origin" },
        `${expectedOrigin}/path`,
      ),
    ).toEqual({ allowed: false, reason: "invalid-expected-origin" });
  });
});

describe("session cookie acceptance policy", () => {
  it("accepts a secure host-only HttpOnly cookie", () => {
    expect(
      assessSessionCookie(
        "__Host-quorum_session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax",
      ),
    ).toEqual({ accepted: true });
  });

  it.each([
    ["session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax", "missing-host-prefix"],
    ["__Host-session=opaque; Path=/; HttpOnly; SameSite=Lax", "missing-secure"],
    ["__Host-session=opaque; Path=/; Secure; SameSite=Lax", "missing-http-only"],
    ["__Host-session=opaque; Secure; HttpOnly; SameSite=Lax", "invalid-path"],
    [
      "__Host-session=opaque; Path=/; Domain=example.test; Secure; HttpOnly; SameSite=Lax",
      "domain-present",
    ],
    ["__Host-session=opaque; Path=/; Secure; HttpOnly", "invalid-same-site"],
    [
      "__Host-session=opaque; Path=/; Secure; HttpOnly; SameSite=None",
      "invalid-same-site",
    ],
  ])("rejects %s", (cookie, reason) => {
    expect(assessSessionCookie(cookie)).toEqual({ accepted: false, reason });
  });
});
