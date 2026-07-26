import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["lib/auth-v2/spike/**/*.integration.test.ts"],
    testTimeout: 15_000,
  },
});
