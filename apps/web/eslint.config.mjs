import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "coverage/**"]),
]);
