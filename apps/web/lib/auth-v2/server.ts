import "server-only";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { parseAuthEnvironment } from "./config";
import { createAuthMailer } from "./mail";
import { buildBetterAuthOptions } from "./options";

type Auth = ReturnType<typeof betterAuth>;

let authInstance: Auth | undefined;

export function getAuth(): Auth {
  if (authInstance) return authInstance;

  const config = parseAuthEnvironment(process.env);
  const database = new Pool({
    connectionString: config.databaseURL,
    options: "-c search_path=better_auth,pg_catalog,pg_temp",
  });
  const mail = createAuthMailer(process.env);

  authInstance = betterAuth(buildBetterAuthOptions({
    config,
    database,
    sendChangeEmailConfirmation: mail.emailChange,
    sendResetPassword: mail.passwordReset,
    sendVerificationEmail: mail.verification,
  }));
  return authInstance;
}
