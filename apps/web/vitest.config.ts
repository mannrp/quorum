import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./vitest.server-only.ts", import.meta.url)),
      react: fileURLToPath(new URL("../../node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("../../node_modules/react-dom", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/*.integration.test.ts"],
    restoreMocks: true,
  },
});
