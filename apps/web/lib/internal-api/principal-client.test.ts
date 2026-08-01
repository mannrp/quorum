// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { decodeJwt, generateKeyPair } from "jose";
import { createInternalAssertionSigner } from "./assertion";
import { createPrincipalClient } from "./principal-client";

describe("private principal client", () => {
  it("derives identity from the server session and never asserts email or role", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const signer = createInternalAssertionSigner({
      issuer: "quorum-next",
      audience: "quorum-go",
      keyId: "active",
      privateKey,
    });
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (!init) throw new Error("Request options are required.");
      const assertion = new Headers(init.headers).get("X-Quorum-Assertion");
      expect(assertion).toBeTruthy();
      const claims = decodeJwt(assertion!);
      expect(claims).toMatchObject({
        sub: "auth-user-1",
        identity_realm: "primary",
        actor_kind: "AUTHENTICATED",
      });
      expect(claims).not.toHaveProperty("email");
      expect(claims).not.toHaveProperty("role");
      expect(JSON.parse(String(init.body))).toEqual({
        role: "STUDENT",
        verifiedEmail: "user@example.test",
      });
      return Response.json({
        viewer: {
          productUserId: "product-1",
          accountState: "ACTIVE",
          onboardingState: "NOT_STARTED",
          username: null,
          displayName: null,
          selfServiceRoles: ["STUDENT"],
        },
      });
    });

    const client = createPrincipalClient({
      baseURL: "http://127.0.0.1:8080",
      signer,
      fetch: request,
      correlationId: () => "corr-1",
      assertionId: () => "jti-1",
      session: async () => ({
        user: { id: "auth-user-1", email: "user@example.test", emailVerified: true },
        session: {
          authenticatedAt: new Date(),
          authenticationMethods: '["password"]',
          assurance: "aal1",
          deviceHandle: "device-1",
        },
      }),
    });

    await expect(client.enroll(new Headers(), "STUDENT")).resolves.toMatchObject({
      productUserId: "product-1",
      selfServiceRoles: ["STUDENT"],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects unverified sessions, authority roles, and malformed private projections", async () => {
    const { privateKey } = await generateKeyPair("EdDSA");
    const signer = createInternalAssertionSigner({ issuer: "quorum-next", audience: "quorum-go", keyId: "active", privateKey });
    const base = {
      baseURL: "http://127.0.0.1:8080",
      signer,
      correlationId: () => "corr-1",
      assertionId: () => "jti-1",
    };

    const unverified = createPrincipalClient({
      ...base,
      fetch: vi.fn(),
      session: async () => ({
        user: { id: "auth-user-1", email: "user@example.test", emailVerified: false },
        session: { authenticatedAt: new Date(), authenticationMethods: '["password"]', assurance: "aal1", deviceHandle: "device-1" },
      }),
    });
    await expect(unverified.enroll(new Headers(), "STUDENT")).rejects.toThrow("verified");

    await expect(unverified.enroll(new Headers(), "ADMIN" as "STUDENT")).rejects.toThrow("role");

    const malformed = createPrincipalClient({
      ...base,
      session: async () => ({
        user: { id: "auth-user-1", email: "user@example.test", emailVerified: true },
        session: { authenticatedAt: new Date(), authenticationMethods: '["password"]', assurance: "aal1", deviceHandle: "device-1" },
      }),
      fetch: vi.fn(async () => Response.json({ viewer: { productUserId: "product-1", email: "leak@example.test" } })),
    });
    await expect(malformed.viewer(new Headers())).rejects.toThrow("projection");
  });
});
