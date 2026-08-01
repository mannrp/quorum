// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseAuthEnvironment } from "./config";

const validEnvironment = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "q".repeat(32),
  BETTER_AUTH_URL: "https://quorum.example",
  AUTH_DATABASE_URL: "postgresql://quorum_auth_runtime:secret@postgres:5432/quorum",
};

describe("Auth V2 server configuration", () => {
  it("builds the accepted production policy without a domain cookie", () => {
    expect(parseAuthEnvironment(validEnvironment)).toEqual({
      baseURL: "https://quorum.example",
      databaseURL: validEnvironment.AUTH_DATABASE_URL,
      secret: validEnvironment.BETTER_AUTH_SECRET,
      trustedOrigins: ["https://quorum.example"],
      cookie: { secure: true, httpOnly: true, sameSite: "lax" },
      password: { minLength: 29, maxLength: 128 },
      session: { idleSeconds: 86_400, absoluteSeconds: 604_800, recentAuthSeconds: 600 },
      databaseSchema: "better_auth",
      allowImplicitSameEmailLinking: false,
    });
  });

  it.each([
    ["a short secret", { BETTER_AUTH_SECRET: "too-short" }],
    ["an insecure production origin", { BETTER_AUTH_URL: "http://quorum.example" }],
    ["an origin with credentials", { BETTER_AUTH_URL: "https://user:pass@quorum.example" }],
    ["an origin with a path", { BETTER_AUTH_URL: "https://quorum.example/auth" }],
    ["a non-PostgreSQL database", { AUTH_DATABASE_URL: "mysql://db/quorum" }],
  ])("rejects %s", (_label, override) => {
    expect(() => parseAuthEnvironment({ ...validEnvironment, ...override })).toThrow();
  });

  it("permits an explicit HTTP loopback origin only outside production", () => {
    const config = parseAuthEnvironment({
      ...validEnvironment,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
    });

    expect(config.baseURL).toBe("http://127.0.0.1:3000");
    expect(config.cookie.secure).toBe(false);
  });
});
