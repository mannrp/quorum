import { describe, expect, it } from "vitest";

import {
  AUTH_SPIKE_ROUTE_ALLOWLIST,
  authorizeSpikeRoute,
  projectCredentialSafeJson,
} from "./route-policy";

describe("auth spike route policy", () => {
  it("defines every exposed operation with an exact method, path, and purpose", () => {
    expect(AUTH_SPIKE_ROUTE_ALLOWLIST).toEqual(
      expect.arrayContaining([
        {
          method: "POST",
          path: "/api/auth-v2/spike/sign-in",
          purpose: "create-session",
        },
        {
          method: "POST",
          path: "/api/auth-v2/spike/sign-out",
          purpose: "revoke-current-session",
        },
        {
          method: "GET",
          path: "/api/auth-v2/spike/sessions",
          purpose: "list-sessions",
        },
      ]),
    );

    for (const route of AUTH_SPIKE_ROUTE_ALLOWLIST) {
      expect(route.path.startsWith("/api/auth-v2/spike/")).toBe(true);
      expect(route.purpose.length).toBeGreaterThan(0);
    }
  });

  it("returns 404 for unknown and credential-export routes", () => {
    expect(authorizeSpikeRoute("GET", "/api/auth-v2/spike/unknown")).toEqual({
      allowed: false,
      status: 404,
    });
    expect(
      authorizeSpikeRoute("GET", "/api/auth-v2/spike/get-access-token"),
    ).toEqual({ allowed: false, status: 404 });
    expect(
      authorizeSpikeRoute("POST", "/api/auth-v2/spike/refresh-token"),
    ).toEqual({ allowed: false, status: 404 });
  });

  it("returns 405 when a known path is called with the wrong method", () => {
    expect(authorizeSpikeRoute("GET", "/api/auth-v2/spike/sign-in")).toEqual({
      allowed: false,
      status: 405,
    });
  });

  it("returns the allowlisted purpose for an exact match", () => {
    expect(authorizeSpikeRoute("POST", "/api/auth-v2/spike/sign-in")).toEqual({
      allowed: true,
      purpose: "create-session",
    });
  });
});

describe("credential-safe response projection", () => {
  it("emits only explicitly safe fields without mutating the provider value", () => {
    const providerValue = {
      user: { id: "user-1", email: "member@example.test" },
      session: {
        id: "session-1",
        token: "opaque-session-secret",
        accessToken: "oauth-access-secret",
        refresh_token: "oauth-refresh-secret",
      },
      nested: [
        { idToken: "oidc-secret", safe: true },
        { password: "password-secret", backupCodes: ["recovery-secret"] },
      ],
      credential: "unknown-provider-secret",
      secret: "provider-secret",
    };

    expect(projectCredentialSafeJson(providerValue)).toEqual({
      user: { id: "user-1", email: "member@example.test" },
      session: { id: "session-1" },
    });
    expect(providerValue.session.token).toBe("opaque-session-secret");
  });

  it("preserves only allowlisted top-level status fields", () => {
    expect(
      projectCredentialSafeJson({ ok: true, count: 0, next: null, debug: "drop" }),
    ).toEqual({ ok: true, count: 0, next: null });
  });

  it("drops wrong-typed values even when they use allowlisted field names", () => {
    expect(
      projectCredentialSafeJson({
        ok: "true",
        count: -1,
        next: { token: "cursor-secret" },
        user: {
          id: { token: "nested-secret" },
          email: ["member@example.test"],
          emailVerified: "yes",
          name: null,
        },
        session: {
          id: "session-1",
          current: "true",
          expiresAt: { token: "nested-secret" },
        },
        sessions: [
          { id: { token: "nested-secret" }, current: true },
          { id: "session-2", current: false },
        ],
      }),
    ).toEqual({
      user: { name: null },
      session: { id: "session-1" },
      sessions: [{ current: true }, { id: "session-2", current: false }],
    });
  });
});
