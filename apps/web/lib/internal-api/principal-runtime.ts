import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { importPKCS8 } from "jose";
import { getCurrentAuthSession } from "@/lib/auth-v2/server";
import { createInternalAssertionSigner } from "./assertion";
import { AuthenticationRequiredError, createPrincipalClient } from "./principal-client";
import { internalAPIBaseURL, internalAPIRequest } from "./request";

let runtimePromise: ReturnType<typeof buildRuntime> | undefined;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is required.");
  return value;
}

function privateKeyPEM(encoded: string): string {
  const body = Buffer.from(encoded, "base64url").toString("base64").match(/.{1,64}/g)?.join("\n");
  if (!body) throw new Error("INTERNAL_ASSERTION_PRIVATE_KEY is invalid.");
  return "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----";
}

async function buildRuntime() {
  const secret = required("BETTER_AUTH_SECRET");
  const privateKey = await importPKCS8(privateKeyPEM(required("INTERNAL_ASSERTION_PRIVATE_KEY")), "EdDSA");
  const signer = createInternalAssertionSigner({
    issuer: required("INTERNAL_ASSERTION_ISSUER"),
    audience: required("INTERNAL_ASSERTION_AUDIENCE"),
    keyId: required("INTERNAL_ASSERTION_KEY_ID"),
    privateKey,
  });

  const session = async (headers: Headers) => {
    const value = await getCurrentAuthSession(headers);
    if (!value) return null;
    const context = value.session as typeof value.session & {
      authenticatedAt?: Date | string;
      authenticationMethods?: string;
      assurance?: string;
    };
    const authenticatedAt = new Date(context.authenticatedAt ?? "");
    if (Number.isNaN(authenticatedAt.getTime()) || !context.authenticationMethods || !context.assurance) {
      throw new Error("The authentication session lacks required context.");
    }
    return {
      user: { id: value.user.id, email: value.user.email, emailVerified: value.user.emailVerified },
      session: {
        authenticatedAt,
        authenticationMethods: context.authenticationMethods,
        assurance: context.assurance,
        deviceHandle: createHmac("sha256", secret).update(value.session.id).digest("base64url"),
      },
    };
  };

  const anonymousHeaders = async () => {
    const correlationId = randomUUID();
    const assertion = await signer.anonymous({ correlationId, assertionId: randomUUID() });
    return { "X-Correlation-ID": correlationId, "X-Quorum-Assertion": assertion };
  };
  const assertionHeaders = async (headers: Headers) => {
    const current = await session(headers);
    if (!current?.user.emailVerified) throw new AuthenticationRequiredError();
    const methods = JSON.parse(current.session.authenticationMethods) as unknown;
    if (!Array.isArray(methods) || methods.length === 0 || !methods.every((item) => typeof item === "string")) {
      throw new Error("Invalid authentication method context.");
    }
    const correlationId = randomUUID();
    const assertion = await signer.authenticated({
      identityRealm: "primary",
      subject: current.user.id,
      authenticatedAt: current.session.authenticatedAt,
      authenticationMethods: methods,
      assurance: current.session.assurance,
      deviceHandle: current.session.deviceHandle,
      correlationId,
      assertionId: randomUUID(),
    });
    return { "X-Correlation-ID": correlationId, "X-Quorum-Assertion": assertion };
  };

  return {
    client: createPrincipalClient({
      baseURL: internalAPIBaseURL(),
      fetch: internalAPIRequest,
      signer,
      correlationId: randomUUID,
      assertionId: randomUUID,
      session,
    }),
    anonymousHeaders,
    assertionHeaders,
  };
}

export async function getPrincipalClient() {
  runtimePromise ??= buildRuntime();
  return (await runtimePromise).client;
}

export async function getInternalAssertionHeaders(headers: Headers) {
  runtimePromise ??= buildRuntime();
  return (await runtimePromise).assertionHeaders(headers);
}
export async function getAnonymousAssertionHeaders() {
  runtimePromise ??= buildRuntime();
  return (await runtimePromise).anonymousHeaders();
}