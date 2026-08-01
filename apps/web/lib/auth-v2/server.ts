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

export function getAuth(): Auth {
  if (authInstance) return authInstance;

  const config = parseAuthEnvironment(process.env);
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

export async function handleAuthRequest(request: Request): Promise<Response> {
  const auth = getAuth();
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/auth/verify-email") {
    const token = url.searchParams.get("token");
    if (!token || !verificationTokens || !(await verificationTokens.consume(token))) {
      return Response.json({ error: "Invalid or consumed verification link." }, { status: 410 });
    }
  }

  return auth.handler(request);
}
