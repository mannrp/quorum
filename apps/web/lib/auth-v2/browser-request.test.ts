// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readEnrollmentRequest, readSessionRevocationRequest } from "./browser-request";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://quorum.example/api/v1/enrollment", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://quorum.example",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body,
  });
}

describe("enrollment browser boundary", () => {
  it("accepts only a self-service role", async () => {
    await expect(readEnrollmentRequest(request('{"role":"STUDENT"}'), "https://quorum.example")).resolves.toBe("STUDENT");
    await expect(readEnrollmentRequest(request('{"role":"SPONSOR"}'), "https://quorum.example")).resolves.toBe("SPONSOR");
  });

  it.each([
    ["wrong origin", request('{"role":"STUDENT"}', { origin: "https://wrong.example" })],
    ["cross-site fetch", request('{"role":"STUDENT"}', { "sec-fetch-site": "cross-site" })],
    ["missing Fetch Metadata", request('{"role":"STUDENT"}', { "sec-fetch-site": "" })],
    ["wrong content type", request('{"role":"STUDENT"}', { "content-type": "text/plain" })],
    ["authority role", request('{"role":"ADMIN"}')],
    ["identity spoof", request('{"role":"STUDENT","subject":"attacker"}')],
    ["email spoof", request('{"role":"STUDENT","verifiedEmail":"attacker@example.test"}')],
  ])("rejects %s", async (_name, input) => {
    await expect(readEnrollmentRequest(input, "https://quorum.example")).rejects.toThrow();
  });
});
describe("session revocation browser boundary", () => {
  it.each([
    ['{"scope":"ONE","sessionId":"session-1"}', { scope: "ONE", sessionId: "session-1" }],
    ['{"scope":"OTHERS"}', { scope: "OTHERS" }],
    ['{"scope":"ALL"}', { scope: "ALL" }],
  ])("accepts %s", async (body, expected) => {
    await expect(readSessionRevocationRequest(request(body), "https://quorum.example")).resolves.toEqual(expected);
  });

  it.each([
    ['{"scope":"ONE"}'],
    ['{"scope":"ONE","sessionId":""}'],
    ['{"scope":"OTHERS","sessionId":"session-1"}'],
    ['{"scope":"ALL","userId":"attacker"}'],
    ['{"scope":"UNKNOWN"}'],
  ])("rejects %s", async (body) => {
    await expect(readSessionRevocationRequest(request(body), "https://quorum.example")).rejects.toThrow();
  });
});
