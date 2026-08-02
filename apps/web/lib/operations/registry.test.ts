// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveOperation } from "./registry";

describe("registered browser operations", () => {
  it("resolves PublicHomeV1 to a server-owned anonymous document", () => {
    const operation = resolveOperation("PublicHomeV1", {});
    expect(operation.auth).toBe("anonymous");
    expect(operation.variables).toEqual({});
    expect(operation.document).toContain("query PublicHomeV1");
    expect(operation.document).not.toContain("fileUrl");
  });

  it.each([
    ["PublicTeamsV1", {}, "query PublicTeamsV1"],
    ["PublicTeamsV1", { search: "robotics" }, "query PublicTeamsV1"],
    ["PublicProjectsV1", {}, "query PublicProjectsV1"],
    ["PublicProjectsV1", { search: "health" }, "query PublicProjectsV1"],
    ["PublicTeamV1", { id: "11111111-1111-4111-8111-111111111111" }, "query PublicTeamV1"],
    ["PublicProjectV1", { id: "22222222-2222-4222-8222-222222222222" }, "query PublicProjectV1"],
    ["PublicProfileV1", { username: "safe-user" }, "query PublicProfileV1"],
  ])("resolves %s with validated public variables", (id, variables, documentName) => {
    const operation = resolveOperation(id, variables);
    expect(operation.auth).toBe("anonymous");
    expect(operation.variables).toEqual(variables);
    expect(operation.document).toContain(documentName);
    expect(operation.document).not.toMatch(/authUserId|email|permissions|applications|fileUrl|resumeUrl|discordLink/);
  });

  it.each([
    ["Unknown", {}],
    ["PublicHomeV1", { query: "{ users { email } }" }],
    ["PublicHomeV1", { userId: "forged" }],
    ["PublicTeamsV1", { search: "x".repeat(101) }],
    ["PublicTeamsV1", { search: "ok", role: "ADMIN" }],
    ["PublicProjectV1", { id: "not-a-uuid" }],
    ["PublicProfileV1", { username: "../admin" }],
  ])("rejects unregistered or expanded input for %s", (id, variables) => {
    expect(() => resolveOperation(id, variables)).toThrow();
  });
});