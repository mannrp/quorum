// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { createInternalAssertionSigner } from "./assertion";

describe("internal assertion signer", () => {
  it("mints a 15-second authenticated assertion without authority claims", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA");
    const now = new Date("2027-01-15T08:00:00Z");
    const signer = createInternalAssertionSigner({ issuer:"quorum-next", audience:"quorum-go", keyId:"active", privateKey, now:()=>now });
    const token = await signer.authenticated({ identityRealm:"primary", subject:"better-auth-user-1", authenticatedAt:new Date(now.getTime()-60_000), authenticationMethods:["pwd"], assurance:"AAL1", deviceHandle:"device-1", correlationId:"corr-1", assertionId:"jti-1" });
    const verified = await jwtVerify(token, publicKey, { algorithms:["EdDSA"], issuer:"quorum-next", audience:"quorum-go", typ:"quorum-internal+jwt", currentDate:now });
    expect(verified.payload.exp! - verified.payload.iat!).toBe(15);
    expect(verified.payload).toMatchObject({ typ:"quorum-internal-v1", actor_kind:"AUTHENTICATED", sub:"better-auth-user-1", identity_realm:"primary", correlation_id:"corr-1" });
    for (const name of ["role","roles","permission","permissions","email","approval"]) expect(verified.payload).not.toHaveProperty(name);
    expect(await exportJWK(publicKey)).toMatchObject({ kty:"OKP", crv:"Ed25519" });
  });

  it("mints an anonymous assertion without fabricated identity claims", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA");
    const now = new Date("2027-01-15T08:00:00Z");
    const signer = createInternalAssertionSigner({ issuer:"quorum-next", audience:"quorum-go", keyId:"active", privateKey, now:()=>now });
    const token = await signer.anonymous({ correlationId:"corr-anon", assertionId:"jti-anon" });
    const { payload } = await jwtVerify(token, publicKey, { algorithms:["EdDSA"], currentDate:now });
    expect(payload.actor_kind).toBe("ANONYMOUS");
    for (const name of ["sub","identity_realm","authenticated_at","amr","assurance","device_handle"]) expect(payload).not.toHaveProperty(name);
  });
});