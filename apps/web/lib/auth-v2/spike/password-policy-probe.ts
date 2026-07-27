type PasswordProbeExpectation = "accept" | "reject";

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
    probe("minimum", "a".repeat(15), "accept"),
    probe("required-supported-length", "a".repeat(64), "accept"),
    probe("target-maximum", "a".repeat(128), "accept"),
    probe("above-target-maximum", "a".repeat(129), "reject"),
  ]);
