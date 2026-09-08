// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSessionClient } from "./session-client";

const session = {
  id: "session-row-1",
  createdAt: "2026-08-01T12:00:00.000Z",
  expiresAt: "2026-08-02T12:00:00.000Z",
  current: true,
};

describe("browser session client", () => {
  it("accepts the narrow session projection and sends only the selected row id", async () => {
    const request = vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        expect(JSON.parse(String(init.body))).toEqual({ scope: "ONE", sessionId: "session-row-1" });
        expect(String(init.body)).not.toContain("token");
        return Response.json({ revokedCurrent: true });
      }
      expect(input).toBe("/api/v1/sessions");
      return Response.json({ sessions: [session] });
    });
    const invalidate = vi.fn();
    const client = createSessionClient(request as typeof fetch, invalidate);
    await expect(client.list()).resolves.toEqual([session]);
    await expect(client.revoke({ scope: "ONE", sessionId: "session-row-1" })).resolves.toEqual({ revokedCurrent: true });
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("rejects any credential-bearing or expanded session projection", async () => {
    const client = createSessionClient(vi.fn(async () => Response.json({
      sessions: [{ ...session, token: "reusable-secret" }],
    })) as typeof fetch);
    await expect(client.list()).rejects.toThrow("projection");
  });
});