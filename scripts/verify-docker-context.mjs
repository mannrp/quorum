import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const output = mkdtempSync(join(tmpdir(), "quorum-context-"));
const sentinels = [
  join(root, ".env.context-sentinel"),
  join(root, "context-sentinel.pem"),
  join(root, "node_modules", "quorum-context-sentinel.txt"),
  join(root, ".git", "quorum-context-sentinel.txt"),
];

try {
  mkdirSync(join(root, "node_modules"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  for (const sentinel of sentinels) writeFileSync(sentinel, "must-not-enter-build-context\n", { flag: "wx" });

  const build = spawnSync(
    "docker",
    ["buildx", "build", "--file", "scripts/docker-context.Dockerfile", "--output", `type=local,dest=${output}`, "."],
    { cwd: root, encoding: "utf8", shell: process.platform === "win32" },
  );
  if (build.status !== 0) {
    throw new Error(`Docker context build failed:\n${build.stdout}\n${build.stderr}`);
  }

  const exported = join(output, "context");
  const forbidden = [
    join(exported, ".env.context-sentinel"),
    join(exported, "context-sentinel.pem"),
    join(exported, "node_modules", "quorum-context-sentinel.txt"),
    join(exported, ".git", "quorum-context-sentinel.txt"),
  ];
  for (const path of forbidden) {
    if (existsSync(path)) throw new Error(`sensitive sentinel entered Docker context: ${path}`);
  }
  if (!existsSync(join(exported, "apps", "api", "migrations", "000001_initial_schema.sql"))) {
    throw new Error("canonical SQL migrations were incorrectly excluded from Docker context");
  }
  console.log("Docker context sentinel verification passed");
} finally {
  for (const sentinel of sentinels) rmSync(sentinel, { force: true });
  rmSync(output, { recursive: true, force: true });
}
