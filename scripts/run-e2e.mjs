import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.QUORUM_REQUIRE_INTEGRATION !== "true") {
  throw new Error("QUORUM_REQUIRE_INTEGRATION=true is required for browser tests");
}
const children = [];
let apiExecutable;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for authenticated browser tests`);
  return value;
}

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, { stdio: "inherit", windowsHide: true, ...options });
  children.push(child);
  return child;
}

async function cleanup() {
  for (const child of children.reverse()) {
    if (child.exitCode === null && process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else if (child.exitCode === null) {
      child.kill();
    }
  }
  await Promise.all(children.map((child) => new Promise((resolveExit) => {
    if (child.exitCode !== null) resolveExit();
    else child.once("exit", resolveExit);
  })));
  if (apiExecutable && existsSync(apiExecutable)) unlinkSync(apiExecutable);
}

async function waitFor(url, child, label) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Startup is expected to refuse connections briefly.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function runProcess(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawnChild(command, args, options);
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun(code ?? (signal ? 1 : 0)));
  });
}

const childEnv = { ...process.env };
required("DATABASE_URL");
required("AUTH_DATABASE_URL");
required("BETTER_AUTH_SECRET");
required("SMTP_HOST");
required("SMTP_PORT");
required("MAILPIT_API_URL");

const oidcBaseURL = "http://127.0.0.1:19090";
const oidcClientId = "quorum-test-client";
const oidcClientSecret = "quorum-test-secret";
const oidcSubject = `quorum-e2e-${randomUUID()}`;
const oidcRedirectURI = "http://127.0.0.1:3000/api/auth/oauth2/callback/quorum-test-oidc";
Object.assign(childEnv, {
  AUTH_TEST_OIDC_BASE_URL: oidcBaseURL,
  AUTH_TEST_OIDC_CLIENT_ID: oidcClientId,
  AUTH_TEST_OIDC_CLIENT_SECRET: oidcClientSecret,
  OIDC_TEST_SUBJECT: oidcSubject,
  NEXT_PUBLIC_AUTH_TEST_OIDC: "true",
  GOOGLE_CLIENT_ID: "quorum-link-test-client",
  GOOGLE_CLIENT_SECRET: "quorum-link-test-secret",
});
const oidcProvider = spawnChild(process.execPath, ["scripts/oidc-test-provider.mjs"], {
  cwd: process.cwd(),
  env: {
    ...childEnv,
    OIDC_TEST_CLIENT_ID: oidcClientId,
    OIDC_TEST_CLIENT_SECRET: oidcClientSecret,
    OIDC_TEST_REDIRECT_URI: oidcRedirectURI,
    OIDC_TEST_SUBJECT: oidcSubject,
  },
  stdio: "ignore",
});
await waitFor(`${oidcBaseURL}/healthz`, oidcProvider, "deterministic OIDC provider");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const encodedPrivateKey = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64url");
const encodedPublicKey = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64url");
const apiArgs = process.platform === "win32" ? ["run", "./cmd/server"] : [];
const apiCommand = process.platform === "win32" ? "go" : (() => {
  apiExecutable = join(tmpdir(), `quorum-e2e-api-${randomUUID()}`);
  const build = spawnSync("go", ["build", "-o", apiExecutable, "./cmd/server"], {
    cwd: join(process.cwd(), "apps/api"),
    encoding: "utf8",
    windowsHide: true,
  });
  if (build.status !== 0) throw new Error(`failed to build e2e API:\n${build.stdout}\n${build.stderr}`);
  return apiExecutable;
})();

const apiEnv = {
  ...childEnv,
  APP_ENV: "development",
  PORT: "18080",
  INTERNAL_ASSERTION_ISSUER: "quorum-next",
  INTERNAL_ASSERTION_AUDIENCE: "quorum-go",
  INTERNAL_ASSERTION_PUBLIC_KEYS: `e2e:${encodedPublicKey}`,
};
const api = spawnChild(apiCommand, apiArgs, { cwd: join(process.cwd(), "apps/api"), env: apiEnv });
await waitFor("http://127.0.0.1:18080/healthz", api, "e2e API");

Object.assign(childEnv, {
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  INTERNAL_API_BASE_URL: "http://127.0.0.1:18080",
  INTERNAL_ASSERTION_ISSUER: "quorum-next",
  INTERNAL_ASSERTION_AUDIENCE: "quorum-go",
  INTERNAL_ASSERTION_KEY_ID: "e2e",
  INTERNAL_ASSERTION_PRIVATE_KEY: encodedPrivateKey,
  SMTP_SECURE: "false",
  SMTP_FROM: "Quorum <no-reply@quorum.local>",
});

const integrationExitCode = await runProcess(process.execPath, ["../../node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"], {
  cwd: join(process.cwd(), "apps/web"),
  env: childEnv,
});
if (integrationExitCode !== 0) {
  await cleanup();
  throw new Error("auth handler integration tests failed");
}

const server = spawnChild(process.execPath, ["scripts/e2e-server.mjs"], {
  cwd: process.cwd(),
  env: childEnv,
  stdio: "ignore", // Next dev request logs can contain one-use verification URLs.
});

let exitCode = 1;
try {
  await waitFor("http://127.0.0.1:3000/", server, "e2e web server");
  exitCode = await runProcess(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
    cwd: process.cwd(),
    env: childEnv,
  });
} finally {
  await cleanup();
}
process.exitCode = exitCode;
