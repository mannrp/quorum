import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["lib/auth-v2/spike/**/*.integration.test.ts"],
    exclude: [
      "lib/auth-v2/spike/better-auth-rate.integration.test.ts",
    ],
    setupFiles: ["./vitest.auth-provider.setup.ts"],
    testTimeout: 30_000,
  },
});
