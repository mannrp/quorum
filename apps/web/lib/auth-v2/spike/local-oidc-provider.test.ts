// @vitest-environment node

import { describe, expect, it } from "vitest";

import { startLocalOidcProvider } from "./local-oidc-provider";

describe("maintained deterministic local OIDC provider", () => {
  it.each([
    "https://quorum.example.test/api/auth-v2/spike/oauth/callback",
    "http://user:password@127.0.0.1:3000/callback",
    "http://127.0.0.1:3000/callback#fragment",
  ])("rejects a non-local or noncanonical callback: %s", async (callbackUrl) => {
    await expect(startLocalOidcProvider({ callbackUrl })).rejects.toThrow(
      "loopback callback",
    );
  });

  it("serves discovery and enforces exact callback plus S256 PKCE", async () => {
    const harness = await startLocalOidcProvider({
      callbackUrl:
        "http://127.0.0.1:3000/api/auth-v2/spike/oauth/callback",
    });

    try {
      const discoveryResponse = await fetch(
        `${harness.issuer}/.well-known/openid-configuration`,
      );
      const discovery = (await discoveryResponse.json()) as Record<string, unknown>;
      expect(discoveryResponse.status).toBe(200);
      expect(discovery).toMatchObject({
        issuer: harness.issuer,
        authorization_endpoint: `${harness.issuer}/auth`,
        token_endpoint: `${harness.issuer}/token`,
        code_challenge_methods_supported: ["S256"],
      });
      expect(discovery.response_types_supported).toEqual(
        expect.arrayContaining(["code"]),
      );

      const common = new URLSearchParams({
        client_id: harness.clientId,
        response_type: "code",
        scope: "openid email",
        state: "state-control",
        nonce: "nonce-control",
      });
      const wrongCallback = new URLSearchParams(common);
      wrongCallback.set("redirect_uri", "http://attacker.example.test/callback");
      wrongCallback.set("code_challenge", "a".repeat(43));
      wrongCallback.set("code_challenge_method", "S256");

      const wrongCallbackResponse = await fetch(
        `${harness.issuer}/auth?${wrongCallback}`,
        { redirect: "manual" },
      );
      expect(wrongCallbackResponse.status).toBe(400);
      expect(wrongCallbackResponse.headers.get("location")).toBeNull();

      const missingPkce = new URLSearchParams(common);
      missingPkce.set("redirect_uri", harness.callbackUrl);
      const missingPkceResponse = await fetch(
        `${harness.issuer}/auth?${missingPkce}`,
        { redirect: "manual" },
      );
      const errorLocation = new URL(
        missingPkceResponse.headers.get("location") as string,
      );
      expect(missingPkceResponse.status).toBe(303);
      expect(errorLocation.origin + errorLocation.pathname).toBe(
        harness.callbackUrl,
      );
      expect(errorLocation.searchParams.get("error")).toBe("invalid_request");
      expect(errorLocation.searchParams.get("state")).toBe("state-control");
      expect(errorLocation.searchParams.has("code")).toBe(false);
    } finally {
      await harness.close();
    }
  });
});
