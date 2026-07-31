// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("exact provider dependencies remain development-only", () => {
  it("pins the current candidate, previous-patch fixture, and maintained adapters", async () => {
    const packageJson = JSON.parse(
      await readFile(
        path.resolve(import.meta.dirname, "../../../package.json"),
        "utf8",
      ),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const spikePackages = [
      "@better-auth/utils",
      "@types/nodemailer",
      "@types/pg",
      "better-auth",
      "better-auth-previous",
      "nodemailer",
      "oidc-provider",
      "openid-client",
      "pg",
    ] as const;
    for (const dependency of spikePackages) {
      expect(packageJson.dependencies).not.toHaveProperty(dependency);
    }
    expect(packageJson.devDependencies).toMatchObject({
      "@better-auth/utils": "0.4.2",
      "@types/nodemailer": "8.0.1",
      "@types/pg": "8.20.0",
      "better-auth": "1.6.25",
      "better-auth-previous": "npm:better-auth@1.6.24",
      nodemailer: "9.0.3",
      "oidc-provider": "9.11.1",
      "openid-client": "6.8.4",
      pg: "8.22.0",
    });
  });
});
