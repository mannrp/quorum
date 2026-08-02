// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { internalAPIBaseURL } from "./request";

describe("internal API transport configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires the Unix socket in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_API_SOCKET_PATH", "");
    vi.stubEnv("INTERNAL_API_BASE_URL", "http://api:8080");

    expect(() => internalAPIBaseURL()).toThrow("INTERNAL_API_SOCKET_PATH");
  });

  it("keeps loopback HTTP available for local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_API_SOCKET_PATH", "");
    vi.stubEnv("INTERNAL_API_BASE_URL", "http://127.0.0.1:8080");

    expect(internalAPIBaseURL()).toBe("http://127.0.0.1:8080");
  });
});
