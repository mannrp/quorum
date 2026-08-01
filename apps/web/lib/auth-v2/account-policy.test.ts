// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isRecentSession, projectAccountMethods } from "./account-policy";

describe("account management policy", () => {
  it("accepts only a valid session strictly inside the recent-auth window", () => {
    const now = new Date("2026-08-01T12:10:00.000Z");
    expect(isRecentSession("2026-08-01T12:00:00.001Z", 600, now)).toBe(true);
    expect(isRecentSession("2026-08-01T12:00:00.000Z", 600, now)).toBe(false);
    expect(isRecentSession("invalid", 600, now)).toBe(false);
  });

  it("projects account records to reviewed methods only", () => {
    expect(projectAccountMethods([
      { providerId: "credential", accountId: "private-password", userId: "private-user" },
      { providerId: "google", accountId: "private-google", userId: "private-user" },
      { providerId: "unknown", accountId: "private-other", userId: "private-user" },
    ])).toEqual([{ providerId: "credential" }, { providerId: "google" }]);
  });
});