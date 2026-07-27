import { describe, expect, it, vi } from "vitest";

import { createSpikeHandler, type SpikeProvider } from "./handler";

const trustedOrigin = "https://quorum.example.test";
const noStore = { headers: { "cache-control": "no-store" } } as const;

function request(
  method: string,
  path: string,
  origin: string | undefined = trustedOrigin,
) {
  return {
    method,
    path,
    origin,
    secFetchSite: "same-origin",
  };
}

function configuredHandler(provider: SpikeProvider) {
  return createSpikeHandler({
    environment: { nodeEnv: "test", spikeEnabled: "true" },
    expectedOrigin: trustedOrigin,
    loadProvider: vi.fn(async () => provider),
  });
}

describe("provider-neutral auth spike handler", () => {
  it("returns 404 without loading provider code when disabled", async () => {
    const loadProvider = vi.fn<() => Promise<SpikeProvider>>();
    const handle = createSpikeHandler({
      environment: { nodeEnv: "production", spikeEnabled: "true" },
      expectedOrigin: trustedOrigin,
      loadProvider,
    });

    await expect(
      handle(request("POST", "/api/auth-v2/spike/sign-in")),
    ).resolves.toEqual({
      status: 404,
      body: { error: "not-found" },
      ...noStore,
    });
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it("rejects an unknown route before loading provider code", async () => {
    const loadProvider = vi.fn<() => Promise<SpikeProvider>>();
    const handle = createSpikeHandler({
      environment: { nodeEnv: "test", spikeEnabled: "true" },
      expectedOrigin: trustedOrigin,
      loadProvider,
    });

    await expect(
      handle(request("GET", "/api/auth-v2/spike/get-access-token")),
    ).resolves.toEqual({
      status: 404,
      body: { error: "not-found" },
      ...noStore,
    });
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin mutation before loading provider code", async () => {
    const loadProvider = vi.fn<() => Promise<SpikeProvider>>();
    const handle = createSpikeHandler({
      environment: { nodeEnv: "test", spikeEnabled: "true" },
      expectedOrigin: trustedOrigin,
      loadProvider,
    });

    await expect(
      handle(
        request(
          "POST",
          "/api/auth-v2/spike/sign-in",
          "https://attacker.example.test",
        ),
      ),
    ).resolves.toEqual({
      status: 403,
      body: { error: "forbidden" },
      ...noStore,
    });
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it("projects provider JSON and passes an accepted cookie separately", async () => {
    const dispatch = vi.fn(async () => ({
      status: 200,
      body: {
        user: { id: "user-1", email: "member@example.test" },
        session: { id: "session-1", token: "reusable-secret" },
        accessToken: "oauth-secret",
      },
      setCookies: [
        "__Host-quorum_session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax",
      ],
    }));
    const handle = configuredHandler({ dispatch });

    await expect(
      handle(request("POST", "/api/auth-v2/spike/sign-in")),
    ).resolves.toEqual({
      status: 200,
      body: {
        user: { id: "user-1", email: "member@example.test" },
        session: { id: "session-1" },
      },
      ...noStore,
      setCookies: [
        "__Host-quorum_session=opaque; Path=/; Secure; HttpOnly; SameSite=Lax",
      ],
    });
    expect(dispatch).toHaveBeenCalledWith({
      purpose: "create-session",
      request: expect.objectContaining({ method: "POST" }),
    });
  });

  it("fails closed without forwarding a provider cookie that violates policy", async () => {
    const handle = configuredHandler({
      dispatch: vi.fn(async () => ({
        status: 200,
        body: { ok: true },
        setCookies: ["session=reusable-secret; Path=/"],
      })),
    });

    await expect(
      handle(request("POST", "/api/auth-v2/spike/sign-in")),
    ).resolves.toEqual({
      status: 502,
      body: { error: "provider-rejected" },
      ...noStore,
    });
  });

  it("allows safe reads without requiring mutation headers", async () => {
    const handle = configuredHandler({
      dispatch: vi.fn(async () => ({
        status: 200,
        body: { sessions: [{ id: "session-1", current: true }] },
      })),
    });

    await expect(
      handle(request("GET", "/api/auth-v2/spike/sessions", undefined)),
    ).resolves.toEqual({
      status: 200,
      body: { sessions: [{ id: "session-1", current: true }] },
      ...noStore,
    });
  });
});
