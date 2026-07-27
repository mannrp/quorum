import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { Provider } from "oidc-provider";

export const LOCAL_OIDC_PROVIDER_VERSION = "9.11.0" as const;
export const LOCAL_OIDC_CLIENT_ID = "quorum-auth-v2-spike" as const;

export type LocalOidcHarness = Readonly<{
  issuer: string;
  callbackUrl: string;
  clientId: typeof LOCAL_OIDC_CLIENT_ID;
  close(): Promise<void>;
}>;

function assertLoopbackCallback(value: string): string {
  let callback: URL;
  try {
    callback = new URL(value);
  } catch {
    throw new Error("A canonical HTTP loopback callback is required");
  }

  if (
    callback.protocol !== "http:" ||
    (callback.hostname !== "127.0.0.1" && callback.hostname !== "localhost") ||
    callback.port === "" ||
    callback.pathname === "/" ||
    callback.username !== "" ||
    callback.password !== "" ||
    callback.search !== "" ||
    callback.hash !== ""
  ) {
    throw new Error("A canonical HTTP loopback callback is required");
  }

  return callback.href;
}

async function reserveLoopbackPort(): Promise<number> {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address() as AddressInfo;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

// This is a maintained, loopback-only protocol fixture. Its in-memory adapter,
// development signing keys, and interaction UI are intentionally test-only and
// must never be used as Quorum authentication or exposed by a product route.
export async function startLocalOidcProvider(input: {
  callbackUrl: string;
  authorizationCodeTtlSeconds?: number;
}): Promise<LocalOidcHarness> {
  const callbackUrl = assertLoopbackCallback(input.callbackUrl);
  const authorizationCodeTtlSeconds = input.authorizationCodeTtlSeconds ?? 60;
  if (
    !Number.isInteger(authorizationCodeTtlSeconds) ||
    authorizationCodeTtlSeconds <= 0
  ) {
    throw new Error("Authorization-code TTL must be a positive integer");
  }
  const port = await reserveLoopbackPort();
  const issuer = `http://127.0.0.1:${port}`;
  const provider = new Provider(issuer, {
    clients: [
      {
        client_id: LOCAL_OIDC_CLIENT_ID,
        redirect_uris: [callbackUrl],
        response_types: ["code"],
        grant_types: ["authorization_code"],
        token_endpoint_auth_method: "none",
      },
    ],
    claims: {
      openid: ["sub"],
      email: ["email", "email_verified"],
    },
    findAccount: async () => ({
      accountId: "fixture-subject",
      claims: () => ({
        sub: "fixture-subject",
        email: "fixture-user@example.test",
        email_verified: true,
      }),
    }),
    pkce: { required: () => true },
    ttl: { AuthorizationCode: () => authorizationCodeTtlSeconds },
    features: { devInteractions: { enabled: true } },
  });
  const server = provider.listen(port, "127.0.0.1");
  await once(server, "listening");

  return {
    issuer,
    callbackUrl,
    clientId: LOCAL_OIDC_CLIENT_ID,
    close: () => closeServer(server),
  };
}
