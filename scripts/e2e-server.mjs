import { createServer } from "node:http";
import { resolve } from "node:path";
import next from "next";

const hostname = "127.0.0.1";
const port = 3000;
const app = next({ dev: true, dir: resolve("apps/web"), hostname, port });
await app.prepare();

const server = createServer(app.getRequestHandler());
server.listen(port, hostname);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.closeAllConnections?.();
  await new Promise((resolveClose) => server.close(resolveClose));
  await app.close();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    await close();
    process.exit(0);
  });
}
