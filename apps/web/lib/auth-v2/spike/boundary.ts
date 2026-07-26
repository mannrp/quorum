export const AUTH_PROVIDER_SPIKE = {
  packageName: "better-auth",
  packageVersion: "1.6.25",
  cliPackageName: "auth",
  cliPackageVersion: "1.6.25",
} as const;

type AuthProviderSpikeEnvironment = Readonly<{
  AUTH_PROVIDER_SPIKE_ENABLED?: string;
  NODE_ENV?: string;
}>;

export function isAuthProviderSpikeEnabled(
  environment: AuthProviderSpikeEnvironment,
): boolean {
  const isNonProductionRuntime =
    environment.NODE_ENV === "development" || environment.NODE_ENV === "test";

  return (
    isNonProductionRuntime && environment.AUTH_PROVIDER_SPIKE_ENABLED === "true"
  );
}
