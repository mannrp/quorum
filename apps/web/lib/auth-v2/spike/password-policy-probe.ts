type PasswordProbeExpectation =
  | "accept"
  | "accept-if-code-point-native"
  | "reject";

export type PasswordLengthUnit =
  | "unicode-code-points"
  | "utf-16-code-units"
  | "utf-8-bytes";

export function conservativeMinimumFor(unit: PasswordLengthUnit): number {
  switch (unit) {
    case "unicode-code-points":
      return 15;
    case "utf-16-code-units":
      return 29;
    case "utf-8-bytes":
      return 57;
  }
}

export function measuredPasswordLength(
  value: string,
  unit: PasswordLengthUnit,
): number {
  switch (unit) {
    case "unicode-code-points":
      return Array.from(value).length;
    case "utf-16-code-units":
      return value.length;
    case "utf-8-bytes":
      return new TextEncoder().encode(value).byteLength;
  }
}

export type PasswordPolicyProbe = Readonly<{
  id: string;
  value: string;
  codePoints: number;
  expected: PasswordProbeExpectation;
}>;

function probe(
  id: string,
  value: string,
  expected: PasswordProbeExpectation,
): PasswordPolicyProbe {
  return Object.freeze({
    id,
    value,
    codePoints: Array.from(value).length,
    expected,
  });
}

// These are provider acceptance vectors only. They must never become Quorum's
// runtime password validator or otherwise receive production credentials.
export const PASSWORD_POLICY_PROBES: readonly PasswordPolicyProbe[] =
  Object.freeze([
    probe("below-minimum-ascii", "a".repeat(14), "reject"),
    probe(
      "below-minimum-supplementary-code-point",
      `${"a".repeat(13)}\u{1F512}`,
      "reject",
    ),
    probe("below-minimum-maximum-width", "\u{1F512}".repeat(14), "reject"),
    probe("minimum-ascii", "a".repeat(15), "accept-if-code-point-native"),
    probe("minimum-maximum-width", "\u{1F512}".repeat(15), "accept"),
    probe("required-supported-length", "a".repeat(64), "accept"),
    probe("target-maximum", "a".repeat(128), "accept"),
    probe("above-target-maximum", "a".repeat(129), "reject"),
  ]);
