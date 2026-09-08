import "server-only";
import type { createInternalAssertionSigner } from "./assertion";
import { parseViewerEnvelope, type SelfServiceRole } from "@/lib/auth-v2/viewer-contract";
export class AuthenticationRequiredError extends Error {
  constructor() {
    super("A verified authenticated session is required.");
  }
}

export class PrincipalRequestError extends Error {
  constructor(readonly status: number) {
    super("Private principal request failed.");
  }
}

type SessionContext = Readonly<{
  user: Readonly<{ id: string; email: string; emailVerified: boolean }>;
  session: Readonly<{
    authenticatedAt: Date;
    authenticationMethods: string;
    assurance: string;
    deviceHandle: string;
  }>;
}>;

type Inputs = Readonly<{
  baseURL: string;
  requireEmailVerification: boolean;
  signer: ReturnType<typeof createInternalAssertionSigner>;
  session(headers: Headers): Promise<SessionContext | null>;
  fetch?: typeof globalThis.fetch;
  correlationId(): string;
  assertionId(): string;
}>;

function privateBaseURL(raw: string): string {
  const url = new URL(raw);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("The private API URL must contain only scheme, host, and optional port.");
  }
  return url.origin;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function createPrincipalClient(inputs: Inputs) {
  const baseURL = privateBaseURL(inputs.baseURL);
  const request = inputs.fetch ?? globalThis.fetch;

  async function call(headers: Headers, path: "/internal/v1/enrollment" | "/internal/v1/viewer", role?: SelfServiceRole) {
    if (role !== undefined && role !== "STUDENT" && role !== "SPONSOR") throw new Error("Invalid enrollment role.");
    const session = await inputs.session(headers);
    if (!session || (inputs.requireEmailVerification && !session.user.emailVerified)) throw new AuthenticationRequiredError();

    let methods: unknown;
    try {
      methods = JSON.parse(session.session.authenticationMethods);
    } catch {
      throw new Error("Invalid authentication method context.");
    }
    if (!stringArray(methods) || methods.length === 0) throw new Error("Invalid authentication method context.");

    const correlationId = inputs.correlationId();
    const assertion = await inputs.signer.authenticated({
      identityRealm: "primary",
      subject: session.user.id,
      authenticatedAt: session.session.authenticatedAt,
      authenticationMethods: methods,
      assurance: session.session.assurance,
      deviceHandle: session.session.deviceHandle,
      correlationId,
      assertionId: inputs.assertionId(),
    });
    const response = await request(baseURL + path, {
      method: role === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
        "X-Quorum-Assertion": assertion,
      },
      body: role === undefined ? undefined : JSON.stringify({ role, verifiedEmail: session.user.emailVerified ? session.user.email : "" }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new PrincipalRequestError(response.status);
    return parseViewerEnvelope(await response.json());
  }

  return {
    enroll: (headers: Headers, role: SelfServiceRole) => call(headers, "/internal/v1/enrollment", role),
    viewer: (headers: Headers) => call(headers, "/internal/v1/viewer"),
  };
}
