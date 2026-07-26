import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = Readonly<{
  license?: string;
  peerDependencies?: Record<string, string>;
  version: string;
}>;

function readJSON(relativePath: string): PackageManifest {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), relativePath), "utf8"),
  ) as PackageManifest;
}

describe("pinned Better Auth compatibility inputs", () => {
  it("uses the repository's exact Node pin and exact stable package versions", () => {
    const web = readJSON("package.json");
    const betterAuth = readJSON("../../node_modules/better-auth/package.json");
    const cli = readJSON("../../node_modules/auth/package.json");
    const pg = readJSON("../../node_modules/pg/package.json");
    const next = readJSON("node_modules/next/package.json");

    expect(readFileSync(resolve(process.cwd(), "../../.nvmrc"), "utf8").trim()).toBe(
      "22.23.1",
    );
    expect(web.version).toBe("0.1.0");
    expect(betterAuth).toMatchObject({ license: "MIT", version: "1.6.25" });
    expect(cli).toMatchObject({ license: "MIT", version: "1.6.25" });
    expect(pg).toMatchObject({ license: "MIT", version: "8.22.0" });
    expect(next.version).toBe("15.5.21");
    expect(betterAuth.peerDependencies).toMatchObject({
      next: "^14.0.0 || ^15.0.0 || ^16.0.0",
      pg: "^8.0.0",
      react: "^18.0.0 || ^19.0.0",
      vitest: "^2.0.0 || ^3.0.0 || ^4.0.0",
    });
  });
});
