import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Client } from "pg";

const operatorValue = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
if (!operatorValue) {
  throw new Error(
    "AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL is required for provider integration tests.",
  );
}

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const webRoot = join(repositoryRoot, "apps", "web");
const vitestEntry = join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
const databaseName = `quorum_auth_spike_${randomBytes(8).toString("hex")}`;
if (!/^quorum_auth_spike_[a-f0-9]{16}$/.test(databaseName)) {
  throw new Error("refusing unsafe provider-spike database name");
}

const operatorURL = new URL(operatorValue);
const adminURL = new URL(operatorURL);
adminURL.pathname = "/postgres";
const isolatedURL = new URL(operatorURL);
isolatedURL.pathname = `/${databaseName}`;
const identifier = `"${databaseName}"`;

const admin = new Client({ connectionString: adminURL.toString() });
await admin.connect();
let created = false;
let testStatus = 1;
try {
  await admin.query(`CREATE DATABASE ${identifier}`);
  created = true;
  const result = spawnSync(
    process.execPath,
    [vitestEntry, "run", "--config", "vitest.auth-provider.final.config.ts"],
    {
      cwd: webRoot,
      env: {
        ...process.env,
        AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL: isolatedURL.toString(),
      },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  testStatus = result.status ?? 1;
} finally {
  if (created) {
    await admin.query(`DROP DATABASE ${identifier} WITH (FORCE)`);
  }
  await admin.end();
}

process.exitCode = testStatus;
