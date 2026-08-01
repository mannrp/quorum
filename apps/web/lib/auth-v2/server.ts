import "server-only";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { parseAuthEnvironment } from "./config";
import { createAuthMailer } from "./mail";
import { buildBetterAuthOptions } from "./options";
import { VerificationTokenStore } from "./verification-token-store";

type Auth = ReturnType<typeof betterAuth>;

let authInstance: Auth | undefined;
let verificationTokens: VerificationTokenStore | undefined;
let canonicalOrigin: string | undefined;

export function getAuth(): Auth {
  if (authInstance) return authInstance;

  const config = parseAuthEnvironment(process.env);
  canonicalOrigin = config.baseURL;
  const database = new Pool({
    connectionString: config.databaseURL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  const mail = createAuthMailer(process.env);
  verificationTokens = new VerificationTokenStore(database);

  authInstance = betterAuth(buildBetterAuthOptions({
    config,
    database,
    sendChangeEmailConfirmation: mail.emailChange,
    sendResetPassword: mail.passwordReset,
    sendVerificationEmail: async (message) => {
      await verificationTokens!.issue(message.token);
      await mail.verification(message);
    },
  }));
  return authInstance;
}

const credentialFields = new Set(["token", "accessToken", "refreshToken", "idToken"]);

function projectAuthValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(projectAuthValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !credentialFields.has(key))
    .map(([key, field]) => [key, projectAuthValue(field)]));
}

async function projectAuthResponse(response: Response): Promise<Response> {
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response;
  const body = await response.clone().text();
  if (!body) return response;
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(projectAuthValue(value), { status: response.status, statusText: response.statusText, headers });
}

export async function handleAuthRequest(request: Request): Promise<Response> {
  const auth = getAuth();
  if (request.method === "POST") {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (
      request.headers.get("origin") !== canonicalOrigin ||
      request.headers.get("sec-fetch-site") !== "same-origin" ||
      contentType !== "application/json"
    ) {
      return Response.json({ error: "Request rejected." }, { status: 403 });
    }
  }
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/auth/verify-email") {
    const token = url.searchParams.get("token");
    if (!token || !verificationTokens || !(await verificationTokens.consume(token))) {
      return Response.json({ error: "Invalid or consumed verification link." }, { status: 410 });
    }
  }

  return projectAuthResponse(await auth.handler(request));
}
