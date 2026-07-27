import { describe, expect, it, vi } from "vitest";

import {
  createSpikeProviderAccessor,
  isAuthProviderSpikeEnabled,
} from "./boundary";

describe("auth provider spike boundary", () => {
  it.each(["development", "test"] as const)(
    "allows the exact opt-in in %s",
    (nodeEnv) => {
      expect(
        isAuthProviderSpikeEnabled({
          nodeEnv,
          spikeEnabled: "true",
        }),
      ).toBe(true);
    },
  );

  it.each([
    { nodeEnv: "production", spikeEnabled: "true" },
    { nodeEnv: "development", spikeEnabled: "TRUE" },
    { nodeEnv: "test", spikeEnabled: "1" },
    { nodeEnv: "test", spikeEnabled: undefined },
  ])("fails closed for $nodeEnv / $spikeEnabled", (environment) => {
    expect(isAuthProviderSpikeEnabled(environment)).toBe(false);
  });

  it("does not load provider code when the boundary is disabled", async () => {
    const loadProvider = vi.fn(async () => ({ name: "candidate" }));
    const provider = createSpikeProviderAccessor(
      { nodeEnv: "production", spikeEnabled: "true" },
      loadProvider,
    );

    await expect(provider()).rejects.toThrow("not available");
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it("loads provider code lazily only after the boundary is enabled", async () => {
    const candidate = { name: "candidate" };
    const loadProvider = vi.fn(async () => candidate);
    const provider = createSpikeProviderAccessor(
      { nodeEnv: "test", spikeEnabled: "true" },
      loadProvider,
    );

    await expect(provider()).resolves.toBe(candidate);
    expect(loadProvider).toHaveBeenCalledOnce();
  });
});
