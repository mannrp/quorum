import { describe, expect, it } from "vitest";

import {
  assessIdentityLinkingTrace,
  assessRateLimitTrace,
} from "./provider-behavior";

describe("multi-instance rate-limit acceptance", () => {
  const passingTrace = [
    { instance: "a", store: "shared", outcome: "allowed" },
    { instance: "b", store: "shared", outcome: "allowed" },
    { instance: "a", store: "shared", outcome: "allowed" },
    { instance: "b", store: "shared", outcome: "denied-limit" },
    { instance: "a", store: "shared", outcome: "denied-limit" },
    { instance: "b", store: "unavailable", outcome: "denied-outage" },
  ] as const;

  it("accepts a shared limit and fail-closed outage control", () => {
    expect(assessRateLimitTrace(passingTrace, 3)).toEqual({ accepted: true });
  });

  it.each([
    [passingTrace.filter(({ instance }) => instance === "a"), "single-instance-only"],
    [
      passingTrace.filter(({ outcome }) => outcome !== "denied-outage"),
      "missing-outage-control",
    ],
    [
      passingTrace.map((event) =>
        event.store === "unavailable" ? event : { ...event, instance: "a" },
      ),
      "two-instance-limit-not-proven",
    ],
    [
      [passingTrace[0], passingTrace[1], passingTrace[3], passingTrace[5]],
      "limit-triggered-early",
    ],
    [
      passingTrace.map((event, index) =>
        index === 3 ? { ...event, outcome: "allowed" as const } : event,
      ),
      "limit-failed-open",
    ],
    [
      [
        ...passingTrace.slice(0, -1),
        { instance: "b", store: "unavailable", outcome: "allowed" },
      ],
      "outage-failed-open",
    ],
    [
      passingTrace.map((event) => ({
        ...event,
        store:
          event.store === "unavailable"
            ? "unavailable"
            : event.instance === "a"
              ? "store-a"
              : "store-b",
      })),
      "store-not-shared",
    ],
  ] as const)("rejects an incomplete or unsafe trace", (trace, reason) => {
    expect(assessRateLimitTrace(trace, 3)).toEqual({
      accepted: false,
      reason,
    });
  });
});

describe("identity linking acceptance", () => {
  const passingTrace = {
    explicitLink: {
      recentlyAuthenticated: true,
      newProviderControlProven: true,
    },
    linkedMethods: [
      { provider: "password", providerSubject: "subject-1", authUserId: "auth-1" },
      { provider: "oidc", providerSubject: "subject-2", authUserId: "auth-1" },
    ],
    sameEmailCollision: {
      firstAuthUserId: "auth-1",
      secondAuthUserId: "auth-2",
      linkedAutomatically: false,
    },
    unlink: { methodsBefore: 2, methodsAfter: 1 },
  } as const;

  it("accepts explicit linking, stable identity, collision isolation, and safe unlink", () => {
    expect(assessIdentityLinkingTrace(passingTrace)).toEqual({ accepted: true });
  });

  it.each([
    [
      {
        ...passingTrace,
        explicitLink: { ...passingTrace.explicitLink, recentlyAuthenticated: false },
      },
      "recent-auth-missing",
    ],
    [
      {
        ...passingTrace,
        explicitLink: {
          ...passingTrace.explicitLink,
          newProviderControlProven: false,
        },
      },
      "provider-control-missing",
    ],
    [
      {
        ...passingTrace,
        linkedMethods: [
          passingTrace.linkedMethods[0],
          { ...passingTrace.linkedMethods[1], authUserId: "auth-2" },
        ],
      },
      "linked-methods-split-identity",
    ],
    [
      {
        ...passingTrace,
        linkedMethods: [
          passingTrace.linkedMethods[0],
          { ...passingTrace.linkedMethods[0] },
        ],
      },
      "duplicate-provider-method",
    ],
    [
      {
        ...passingTrace,
        linkedMethods: [
          passingTrace.linkedMethods[0],
          { ...passingTrace.linkedMethods[1], providerSubject: "" },
        ],
      },
      "invalid-stable-identifier",
    ],
    [
      {
        ...passingTrace,
        sameEmailCollision: {
          ...passingTrace.sameEmailCollision,
          linkedAutomatically: true,
        },
      },
      "same-email-auto-linked",
    ],
    [
      { ...passingTrace, unlink: { methodsBefore: 1, methodsAfter: 0 } },
      "unlink-removes-last-method",
    ],
    [
      { ...passingTrace, unlink: { methodsBefore: 3, methodsAfter: 2 } },
      "unlink-count-mismatch",
    ],
  ] as const)("rejects an unsafe identity trace", (trace, reason) => {
    expect(assessIdentityLinkingTrace(trace)).toEqual({
      accepted: false,
      reason,
    });
  });
});
