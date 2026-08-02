import "server-only";
import nodemailer from "nodemailer";

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function createAuthMailer(environment: Environment) {
  const port = Number(required(environment, "SMTP_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  const user = environment.SMTP_USER?.trim();
  const password = environment.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together.");
  }

  const transporter = nodemailer.createTransport({
    host: required(environment, "SMTP_HOST"),
    port,
    secure: environment.SMTP_SECURE === "true",
    ...(user && password ? { auth: { user, pass: password } } : {}),
  });
  const from = required(environment, "SMTP_FROM");

  return {
    verification: async ({ user, url }: { user: { email: string }; url: string }) => {
      await transporter.sendMail({
        from,
        to: user.email,
        subject: "Verify your Quorum email",
        text: `Verify your email: ${url}`,
      });
    },
    passwordReset: async ({ user, url }: { user: { email: string }; url: string }) => {
      await transporter.sendMail({
        from,
        to: user.email,
        subject: "Reset your Quorum password",
        text: `Reset your password: ${url}`,
      });
    },
    emailChange: async ({ user, newEmail, url }: { user: { email: string }; newEmail: string; url: string }) => {
      await transporter.sendMail({
        from,
        to: user.email,
        subject: "Confirm your Quorum email change",
        text: `Confirm changing your email to ${newEmail}: ${url}`,
      });
    },
  };
}
