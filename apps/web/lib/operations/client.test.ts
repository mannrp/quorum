// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { operationRequest } from "./client";

describe("registered operation client", () => {
  it("sends only the operation id path and typed variables", async () => {
    const request = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toBe("/api/v1/operations/PublicHomeV1");
      expect(JSON.parse(String(init?.body))).toEqual({});
      expect(String(init?.body)).not.toContain("query");
      return Response.json({ data: { projects: [] } });
    });
    await expect(operationRequest<{ projects: [] }>("PublicHomeV1", {}, request as typeof fetch))
      .resolves.toEqual({ projects: [] });
  });

  it("rejects HTTP, GraphQL, and missing-data responses", async () => {
    await expect(operationRequest("PublicHomeV1", {}, vi.fn(async () => new Response("", { status: 404 })) as typeof fetch)).rejects.toThrow();
    await expect(operationRequest("PublicHomeV1", {}, vi.fn(async () => Response.json({ errors: [{ message: "denied" }] })) as typeof fetch)).rejects.toThrow("denied");
    await expect(operationRequest("PublicHomeV1", {}, vi.fn(async () => Response.json({})) as typeof fetch)).rejects.toThrow();
  });
});