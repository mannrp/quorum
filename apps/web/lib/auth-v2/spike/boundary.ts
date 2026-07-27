export type SpikeEnvironment = Readonly<{
  nodeEnv?: string;
  spikeEnabled?: string;
}>;

export function isAuthProviderSpikeEnabled(
  environment: SpikeEnvironment,
): boolean {
  return (
    (environment.nodeEnv === "development" || environment.nodeEnv === "test") &&
    environment.spikeEnabled === "true"
  );
}

export function createSpikeProviderAccessor<Provider>(
  environment: SpikeEnvironment,
  loadProvider: () => Promise<Provider>,
): () => Promise<Provider> {
  if (!isAuthProviderSpikeEnabled(environment)) {
    return async () => {
      throw new Error("The auth provider acceptance spike is not available");
    };
  }

  let provider: Promise<Provider> | undefined;

  return () => {
    provider ??= loadProvider();
    return provider;
  };
}
