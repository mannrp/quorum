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
    ["Unknown", {}],
    ["PublicHomeV1", { query: "{ users { email } }" }],
    ["PublicHomeV1", { userId: "forged" }],
  ])("rejects unregistered or expanded input for %s", (id, variables) => {
    expect(() => resolveOperation(id, variables)).toThrow();
  });
});