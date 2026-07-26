import { describe, expect, it } from "vitest";

import { getAuthProviderSpikeRuntimeConfig } from "./runtime-config";

const validEnvironment = {
  AUTH_PROVIDER_SPIKE_DATABASE_URL:
    "postgres://quorum_auth_runtime:password@127.0.0.1:55432/quorum",
  AUTH_PROVIDER_SPIKE_ENABLED: "true",
  AUTH_PROVIDER_SPIKE_ORIGIN: "http://127.0.0.1:3000",
  AUTH_PROVIDER_SPIKE_SECRET: "a".repeat(32),
  NODE_ENV: "test",
} as const;

describe("auth-provider spike runtime configuration", () => {
  it("returns a schema-isolated, fail-closed configuration", () => {
    expect(getAuthProviderSpikeRuntimeConfig(validEnvironment)).toEqual({
      baseURL: "http://127.0.0.1:3000/api/auth-v2-spike",
      databaseURL: validEnvironment.AUTH_PROVIDER_SPIKE_DATABASE_URL,
      postgresOptions: "-c search_path=better_auth,pg_catalog,pg_temp",
      secret: validEnvironment.AUTH_PROVIDER_SPIKE_SECRET,
      trustedOrigins: ["http://127.0.0.1:3000"],
    });
  });

  it.each([
    ["disabled flag", { ...validEnvironment, AUTH_PROVIDER_SPIKE_ENABLED: "false" }],
    ["production runtime", { ...validEnvironment, NODE_ENV: "production" }],
    ["short secret", { ...validEnvironment, AUTH_PROVIDER_SPIKE_SECRET: "too-short" }],
    ["non-loopback origin", { ...validEnvironment, AUTH_PROVIDER_SPIKE_ORIGIN: "https://example.com" }],
    ["database without loopback host", { ...validEnvironment, AUTH_PROVIDER_SPIKE_DATABASE_URL: "postgres://user:password@db.example.com/quorum" }],
  ])("rejects %s", (_caseName, environment) => {
    expect(() => getAuthProviderSpikeRuntimeConfig(environment)).toThrow();
  });
});
