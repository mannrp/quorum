// One-shot local dev bootstrap: brings up Postgres/Mailpit via Docker Compose,
// bootstraps DB roles + runs migrations (both idempotent), then starts the Go
// API and the Next.js web app together. Ctrl+C stops everything.
//
// Usage: node scripts/dev-up.mjs
// (also wired up as `npm run dev:up`)

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const children = [];

function log(label, msg) {
  console.log(`[dev-up] ${label ? `${label}: ` : ""}${msg}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true, ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
}

function spawnChild(label, command, args, options = {}) {
  const child = spawn(command, args, { stdio: "inherit", windowsHide: true, ...options });
  children.push({ label, child });
  child.on("exit", (code, signal) => {
    log(label, `exited (code=${code} signal=${signal})`);
  });
  return child;
}

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

async function waitFor(url, label, deadlineMs = 60_000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // still starting up
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${label} (${url})`);
}

function cleanupAndExit(code) {
  for (const { label, child } of children.reverse()) {
    if (child.exitCode !== null) continue;
    log(label, "stopping");
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => cleanupAndExit(0));
process.on("SIGTERM", () => cleanupAndExit(0));

for (const [example, target] of [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
]) {
  if (!existsSync(join(root, target))) {
    log("env", `${target} missing; copying from ${example} (fill in secrets before real use)`);
    run("node", ["-e", `require('fs').copyFileSync(${JSON.stringify(example)}, ${JSON.stringify(target)})`]);
  }
}

log("infra", "starting Postgres + Mailpit (docker compose)");
run("docker", ["compose", "-f", "compose.dev.yml", "up", "-d", "--wait"]);

const bootstrapEnv = { ...process.env, ...loadEnvFile(join(root, "auth-v2.env.example")) };

log("db", "bootstrapping roles (idempotent)");
run("go", ["run", "./cmd/bootstrap-roles"], { cwd: join(root, "apps/api"), env: bootstrapEnv });

log("db", "running migrations");
run("go", ["run", "./cmd/migrate"], { cwd: join(root, "apps/api"), env: bootstrapEnv });

log("api", "starting Go API on :8080");
const apiEnv = { ...process.env, ...loadEnvFile(join(root, "apps/api/.env")) };
spawnChild("api", "go", ["run", "./cmd/server"], { cwd: join(root, "apps/api"), env: apiEnv });
await waitFor("http://127.0.0.1:8080/healthz", "api");
log("api", "healthy");

log("web", "starting Next.js dev server on :3000");
spawnChild("web", "npm", ["run", "dev", "--workspace=@quorum/web"], { cwd: root, env: process.env, shell: process.platform === "win32" });
await waitFor("http://127.0.0.1:3000/", "web", 90_000);
log("web", "healthy");

log(null, "Quorum is up: http://localhost:3000  (API privately on :8080, Mailpit UI on :8025)");
log(null, "Press Ctrl+C to stop everything.");
