// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createViewerClient } from "./viewer-client";

const viewer = {
  productUserId: "product-1",
  accountState: "ACTIVE" as const,
  onboardingState: "NOT_STARTED" as const,
  username: null,
  displayName: null,
  selfServiceRoles: ["STUDENT" as const],
};

describe("browser viewer client", () => {
  it("sends only the selected role to the same-origin enrollment route", async () => {
    const request = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.credentials).toBe("same-origin");
      expect(JSON.parse(String(init?.body))).toEqual({ role: "STUDENT" });
      return Response.json({ viewer });
    });
    const client = createViewerClient(request as typeof fetch);
    await expect(client.enroll("STUDENT")).resolves.toEqual(viewer);
  });

  it("distinguishes authentication and enrollment without accepting malformed projections", async () => {
    const unauthenticated = createViewerClient(vi.fn(async () => new Response(null, { status: 401 })) as typeof fetch);
    await expect(unauthenticated.viewer()).resolves.toEqual({ state: "unauthenticated" });

    const unenrolled = createViewerClient(vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch);
    await expect(unenrolled.viewer()).resolves.toEqual({ state: "unenrolled" });

    const malformed = createViewerClient(vi.fn(async () => Response.json({ viewer: { ...viewer, email: "leak@example.test" } })) as typeof fetch);
    await expect(malformed.viewer()).rejects.toThrow("projection");
  });
});
