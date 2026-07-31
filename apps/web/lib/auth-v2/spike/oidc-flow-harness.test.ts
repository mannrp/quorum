// @vitest-environment node

import { describe, expect, it } from "vitest";

import { startLocalOidcProvider } from "./local-oidc-provider";
import { runOidcProtocolAcceptance } from "./oidc-flow-harness";

describe("maintained OAuth/OIDC protocol acceptance flow", () => {
  it("proves success, state, PKCE, nonce, replay, and expiry controls", async () => {
    const provider = await startLocalOidcProvider({
      callbackUrl:
        "http://127.0.0.1:3000/api/auth-v2/spike/oauth/callback",
      authorizationCodeTtlSeconds: 2,
    });

    try {
      await expect(runOidcProtocolAcceptance(provider)).resolves.toEqual({
        success: true,
        wrongStateDenied: true,
        wrongPkceDenied: true,
        wrongNonceDenied: true,
        replayDenied: true,
        expiredCodeDenied: true,
      });
    } finally {
      await provider.close();
    }
  }, 15_000);
});
