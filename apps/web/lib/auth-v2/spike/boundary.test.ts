import { describe, expect, it } from "vitest";

import {
  AUTH_PROVIDER_SPIKE,
  isAuthProviderSpikeEnabled,
} from "./boundary";

describe("auth-provider acceptance-spike boundary", () => {
  it("pins the accepted candidate inputs exactly", () => {
    expect(AUTH_PROVIDER_SPIKE).toEqual({
      packageName: "better-auth",
      packageVersion: "1.6.25",
      cliPackageName: "auth",
      cliPackageVersion: "1.6.25",
    });
  });

  it.each(["development", "test"] as const)(
    "requires the explicit feature flag in %s",
    (nodeEnv) => {
      expect(
        isAuthProviderSpikeEnabled({
          AUTH_PROVIDER_SPIKE_ENABLED: "true",
          NODE_ENV: nodeEnv,
        }),
      ).toBe(true);
      expect(
        isAuthProviderSpikeEnabled({
          AUTH_PROVIDER_SPIKE_ENABLED: "false",
          NODE_ENV: nodeEnv,
        }),
      ).toBe(false);
      expect(isAuthProviderSpikeEnabled({ NODE_ENV: nodeEnv })).toBe(false);
    },
  );

  it("cannot be enabled in production or an unknown environment", () => {
    expect(
      isAuthProviderSpikeEnabled({
        AUTH_PROVIDER_SPIKE_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isAuthProviderSpikeEnabled({
        AUTH_PROVIDER_SPIKE_ENABLED: "true",
        NODE_ENV: undefined,
      }),
    ).toBe(false);
  });
});
