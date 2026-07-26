import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { buildAuthProviderSpikeOptions } from "./provider-options";
import { getAuthProviderSpikeRuntimeConfig } from "./runtime-config";

const runtime = getAuthProviderSpikeRuntimeConfig(process.env);
const database = new Pool({
  allowExitOnIdle: true,
  application_name: "quorum-auth-v2-acceptance-spike",
  connectionString: runtime.databaseURL,
  max: 2,
  options: runtime.postgresOptions,
});

async function rejectUnconfiguredMailDelivery(): Promise<never> {
  throw new Error("The auth-provider spike Mailpit adapter is not configured.");
}

export const auth = betterAuth(
  buildAuthProviderSpikeOptions({
    database,
    runtime,
    sendChangeEmailConfirmation: rejectUnconfiguredMailDelivery,
    sendResetPassword: rejectUnconfiguredMailDelivery,
    sendVerificationEmail: rejectUnconfiguredMailDelivery,
  }),
);
