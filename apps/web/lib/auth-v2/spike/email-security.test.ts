import { describe, expect, it } from "vitest";

import {
  assessEnumerationParity,
  assessPurposeBoundEmailLink,
  assessSecretPageHeaders,
} from "./email-security";

describe("email-flow enumeration acceptance", () => {
  const common = {
    status: 202,
    body: { ok: true },
    setCookies: ["__Host-email_flow=opaque; Path=/; Secure; HttpOnly"],
  };

  it("accepts indistinguishable public outcomes without comparing secrets", () => {
    expect(assessEnumerationParity(common, { ...common })).toEqual({
      accepted: true,
    });
  });

  it.each([
    [{ ...common, status: 404 }, "status-differs"],
    [{ ...common, body: { ok: false } }, "body-differs"],
    [{ ...common, setCookies: [] }, "cookie-shape-differs"],
  ] as const)("rejects distinguishable outcomes", (missingAccount, reason) => {
    expect(assessEnumerationParity(common, missingAccount)).toEqual({
      accepted: false,
      reason,
    });
  });
});

describe("purpose-bound email link acceptance", () => {
  it("accepts an exact callback without returning its secret", () => {
    expect(
      assessPurposeBoundEmailLink(
        "https://quorum.example.test/auth/reset?token=one-time-secret",
        {
          expectedOrigin: "https://quorum.example.test",
          expectedPath: "/auth/reset",
          secretParameter: "token",
        },
      ),
    ).toEqual({ accepted: true });
  });

  it.each([
    [
      "https://attacker.example.test/auth/reset?token=secret",
      "origin-mismatch",
    ],
    [
      "https://quorum.example.test/auth/other?token=secret",
      "path-mismatch",
    ],
    ["https://quorum.example.test/auth/reset", "missing-secret"],
    [
      "https://quorum.example.test/auth/reset?token=one&token=two",
      "ambiguous-secret",
    ],
    [
      "https://quorum.example.test/auth/reset?token=secret&next=https://attacker.test",
      "unexpected-parameter",
    ],
    [
      "https://quorum.example.test/auth/reset?token=secret#fragment",
      "fragment-present",
    ],
    [
      "https://user:password@quorum.example.test/auth/reset?token=secret",
      "credentials-present",
    ],
  ] as const)("rejects %s", (link, reason) => {
    expect(
      assessPurposeBoundEmailLink(link, {
        expectedOrigin: "https://quorum.example.test",
        expectedPath: "/auth/reset",
        secretParameter: "token",
      }),
    ).toEqual({ accepted: false, reason });
  });
});

describe("secret-bearing page headers", () => {
  it("requires no-store and no-referrer", () => {
    expect(
      assessSecretPageHeaders({
        "cache-control": "private, no-store",
        "referrer-policy": "no-referrer",
      }),
    ).toEqual({ accepted: true });
  });

  it.each([
    [{ "referrer-policy": "no-referrer" }, "cacheable"],
    [{ "cache-control": "no-store" }, "referrer-policy-missing"],
    [
      { "cache-control": "no-store", "referrer-policy": "same-origin" },
      "referrer-policy-unsafe",
    ],
  ] as const)("rejects unsafe headers", (headers, reason) => {
    expect(assessSecretPageHeaders(headers)).toEqual({
      accepted: false,
      reason,
    });
  });
});
