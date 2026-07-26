import { spawn } from "node:child_process";

const server = spawn(process.execPath, ["scripts/e2e-server.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: true,
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`e2e server exited with code ${server.exitCode}`);
    try {
      const response = await fetch("http://127.0.0.1:3000/");
      if (response.status < 500) return;
    } catch {
      // Server startup is expected to refuse connections briefly.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("timed out waiting for the e2e server")
}

function runPlaywright() {
  return new Promise((resolveRun, rejectRun) => {
    const test = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
    });
    test.once("error", rejectRun);
    test.once("exit", (code, signal) => resolveRun(code ?? (signal ? 1 : 0)));
  });
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await runPlaywright();
} finally {
  if (server.exitCode === null) server.kill();
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) resolveExit();
    else server.once("exit", resolveExit);
  });
}
process.exitCode = exitCode;
