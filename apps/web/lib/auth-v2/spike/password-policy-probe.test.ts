import { describe, expect, it } from "vitest";

import { PASSWORD_POLICY_PROBES } from "./password-policy-probe";

describe("provider password-policy acceptance probes", () => {
  it("distinguishes Unicode code points from UTF-16 code units", () => {
    const probe = PASSWORD_POLICY_PROBES.find(
      ({ id }) => id === "below-minimum-supplementary-code-point",
    );

    expect(probe).toMatchObject({ expected: "reject", codePoints: 14 });
    expect(probe?.value.length).toBe(15);
  });

  it("covers both sides of the accepted length boundaries", () => {
    expect(
      PASSWORD_POLICY_PROBES.map(({ id, expected, codePoints }) => ({
        id,
        expected,
        codePoints,
      })),
    ).toEqual([
      { id: "below-minimum-ascii", expected: "reject", codePoints: 14 },
      {
        id: "below-minimum-supplementary-code-point",
        expected: "reject",
        codePoints: 14,
      },
      { id: "minimum", expected: "accept", codePoints: 15 },
      { id: "required-supported-length", expected: "accept", codePoints: 64 },
      { id: "target-maximum", expected: "accept", codePoints: 128 },
      { id: "above-target-maximum", expected: "reject", codePoints: 129 },
    ]);
  });
});
