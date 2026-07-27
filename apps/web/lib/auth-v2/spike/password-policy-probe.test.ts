import { describe, expect, it } from "vitest";

import {
  conservativeMinimumFor,
  measuredPasswordLength,
  PASSWORD_POLICY_PROBES,
  type PasswordLengthUnit,
} from "./password-policy-probe";

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
      {
        id: "below-minimum-maximum-width",
        expected: "reject",
        codePoints: 14,
      },
      {
        id: "minimum-ascii",
        expected: "accept-if-code-point-native",
        codePoints: 15,
      },
      { id: "minimum-maximum-width", expected: "accept", codePoints: 15 },
      { id: "required-supported-length", expected: "accept", codePoints: 64 },
      { id: "target-maximum", expected: "accept", codePoints: 128 },
      { id: "above-target-maximum", expected: "reject", codePoints: 129 },
    ]);
  });

  it("derives conservative encoded-unit thresholds from maximum-width controls", () => {
    const units: readonly PasswordLengthUnit[] = [
      "unicode-code-points",
      "utf-16-code-units",
      "utf-8-bytes",
    ];
    const below = "\u{1F512}".repeat(14);
    const minimum = "\u{1F512}".repeat(15);
    const requiredSupported = "a".repeat(64);

    for (const unit of units) {
      const threshold = conservativeMinimumFor(unit);

      expect(measuredPasswordLength(below, unit)).toBeLessThan(threshold);
      expect(measuredPasswordLength(minimum, unit)).toBeGreaterThanOrEqual(
        threshold,
      );
      expect(
        measuredPasswordLength(requiredSupported, unit),
      ).toBeGreaterThanOrEqual(threshold);
    }
  });
});
