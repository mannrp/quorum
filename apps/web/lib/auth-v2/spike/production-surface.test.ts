// @vitest-environment node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(fullPath);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

describe("auth spike production absence", () => {
  it("has no mounted Next route or production import", async () => {
    const applicationRoot = path.resolve(import.meta.dirname, "../../../app");
    const files = await sourceFiles(applicationRoot);
    const normalizedPaths = files.map((file) => file.replaceAll("\\", "/"));

    expect(
      normalizedPaths.filter((file) => file.includes("/auth-v2-spike/")),
    ).toEqual([]);

    const imports = (
      await Promise.all(
        files.map(async (file) => ({ file, source: await readFile(file, "utf8") })),
      )
    ).filter(
      ({ source }) =>
        source.includes("lib/auth-v2/spike") ||
        source.includes("@/lib/auth-v2/spike"),
    );
    expect(imports).toEqual([]);
  });

  it("pins maintained protocol fixtures as development dependencies only", async () => {
    const packageJsonPath = path.resolve(import.meta.dirname, "../../../package.json");
    const packageJson = JSON.parse(
      await readFile(packageJsonPath, "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty("oidc-provider");
    expect(packageJson.dependencies).not.toHaveProperty("openid-client");
    expect(packageJson.devDependencies).toMatchObject({
      "oidc-provider": "9.11.0",
      "openid-client": "6.8.4",
    });
  });
});
