import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;

let authInstance: NeonAuth | null = null;

export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_URL || "";
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || "";

  if (!baseUrl) {
    throw new Error("NEON_AUTH_BASE_URL is required for Neon Auth.");
  }

  if (cookieSecret.length < 32) {
    throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters.");
  }

  authInstance ??= createNeonAuth({
    baseUrl,
    cookies: {
      secret: cookieSecret,
      sessionDataTtl: 300,
      sameSite: "lax",
    },
  });

  return authInstance;
}
