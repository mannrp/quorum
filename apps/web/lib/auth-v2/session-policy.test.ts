// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isWithinAbsoluteLifetime } from "./session-policy";

describe("absolute session lifetime", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("accepts only a finite deadline strictly in the future", () => {
    expect(isWithinAbsoluteLifetime("2026-08-01T12:00:00.001Z", now)).toBe(true);
    expect(isWithinAbsoluteLifetime("2026-08-01T12:00:00.000Z", now)).toBe(false);
    expect(isWithinAbsoluteLifetime("2026-07-31T12:00:00.000Z", now)).toBe(false);
    expect(isWithinAbsoluteLifetime("invalid", now)).toBe(false);
    expect(isWithinAbsoluteLifetime(undefined, now)).toBe(false);
  });
});