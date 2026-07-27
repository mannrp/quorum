import {
  ClientError,
  None,
  ResponseBodyError,
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  type Configuration,
} from "openid-client";

import type { LocalOidcHarness } from "./local-oidc-provider";

type PreparedAuthorization = Readonly<{
  config: Configuration;
  callback: URL;
  codeVerifier: string;
  state: string;
  nonce: string;
}>;

class TestCookieJar {
  readonly #cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    const setCookieHeaders = (
      headers as Headers & { getSetCookie?: () => string[] }
    ).getSetCookie?.() ?? [headers.get("set-cookie")].filter(Boolean) as string[];

    for (const header of setCookieHeaders) {
      const nameValue = header.split(";", 1)[0]?.trim();
      const separator = nameValue?.indexOf("=") ?? -1;
      if (!nameValue || separator <= 0) continue;
      this.#cookies.set(nameValue.slice(0, separator), nameValue);
    }
  }

  header(): string {
    return [...this.#cookies.values()].join("; ");
  }
}

function requiredLocation(response: Response, base: string): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("OIDC fixture response omitted Location");
  return new URL(location, base);
}

async function prepareAuthorization(
  harness: LocalOidcHarness,
): Promise<PreparedAuthorization> {
  const config = await discovery(
    new URL(harness.issuer),
    harness.clientId,
    {
      redirect_uris: [harness.callbackUrl],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    None(),
    { execute: [allowInsecureRequests] },
  );
  const codeVerifier = randomPKCECodeVerifier();
  const state = randomState();
  const nonce = randomNonce();
  const authorizationUrl = buildAuthorizationUrl(config, {
    redirect_uri: harness.callbackUrl,
    response_type: "code",
    scope: "openid email",
    code_challenge: await calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });
  const jar = new TestCookieJar();
  let response = await fetch(authorizationUrl, { redirect: "manual" });
  jar.absorb(response.headers);
  let location = requiredLocation(response, harness.issuer);
  let prompt: "login" | "consent" = "login";

  for (let step = 0; step < 12; step += 1) {
    if (location.origin + location.pathname === harness.callbackUrl) {
      return { config, callback: location, codeVerifier, state, nonce };
    }
    if (location.origin !== harness.issuer) {
      throw new Error("OIDC fixture attempted an unexpected redirect");
    }

    if (location.pathname.startsWith("/interaction/")) {
      response = await fetch(location, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: jar.header(),
        },
        body: new URLSearchParams(
          prompt === "login"
            ? { prompt, login: "fixture-subject" }
            : { prompt },
        ),
      });
      prompt = "consent";
    } else {
      response = await fetch(location, {
        redirect: "manual",
        headers: { cookie: jar.header() },
      });
    }
    jar.absorb(response.headers);
    location = requiredLocation(response, harness.issuer);
  }

  throw new Error("OIDC fixture exceeded its redirect bound");
}

type ExpectedDenial = "invalid-grant" | "state" | "nonce";

function isExpectedProtocolDenial(
  error: unknown,
  expected: ExpectedDenial,
): boolean {
  if (expected === "invalid-grant") {
    return (
      error instanceof ResponseBodyError &&
      error.status === 400 &&
      error.error === "invalid_grant"
    );
  }
  if (!(error instanceof ClientError)) return false;
  return expected === "state"
    ? error.code === "OAUTH_INVALID_RESPONSE"
    : error.code === "OAUTH_JWT_CLAIM_COMPARISON_FAILED";
}

async function denied(
  operation: () => Promise<unknown>,
  expected: ExpectedDenial,
): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch (error) {
    if (!isExpectedProtocolDenial(error, expected)) {
      throw new Error("OIDC negative control failed unexpectedly");
    }
    return true;
  }
}

function exchange(
  prepared: PreparedAuthorization,
  checks: Partial<{
    callback: URL;
    codeVerifier: string;
    state: string;
    nonce: string;
  }> = {},
) {
  return authorizationCodeGrant(
    prepared.config,
    checks.callback ?? prepared.callback,
    {
      pkceCodeVerifier: checks.codeVerifier ?? prepared.codeVerifier,
      expectedState: checks.state ?? prepared.state,
      expectedNonce: checks.nonce ?? prepared.nonce,
      idTokenExpected: true,
    },
  );
}

// Maintained libraries generate and validate all protocol values. This function
// returns booleans only; codes, tokens, verifiers, state, and nonce stay in memory.
export async function runOidcProtocolAcceptance(
  harness: LocalOidcHarness,
): Promise<{
  success: boolean;
  wrongStateDenied: boolean;
  wrongPkceDenied: boolean;
  wrongNonceDenied: boolean;
  replayDenied: boolean;
  expiredCodeDenied: boolean;
}> {
  const successful = await prepareAuthorization(harness);
  const tokens = await exchange(successful);
  const success =
    tokens.claims()?.sub === "fixture-subject" &&
    tokens.claims()?.nonce === successful.nonce;
  const replayDenied = await denied(
    () => exchange(successful),
    "invalid-grant",
  );

  const wrongState = await prepareAuthorization(harness);
  const callbackWithWrongState = new URL(wrongState.callback);
  callbackWithWrongState.searchParams.set("state", randomState());
  const wrongStateDenied = await denied(
    () => exchange(wrongState, { callback: callbackWithWrongState }),
    "state",
  );

  const wrongPkce = await prepareAuthorization(harness);
  const wrongPkceDenied = await denied(
    () => exchange(wrongPkce, { codeVerifier: randomPKCECodeVerifier() }),
    "invalid-grant",
  );

  const wrongNonce = await prepareAuthorization(harness);
  const wrongNonceDenied = await denied(
    () => exchange(wrongNonce, { nonce: randomNonce() }),
    "nonce",
  );

  const expired = await prepareAuthorization(harness);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const expiredCodeDenied = await denied(
    () => exchange(expired),
    "invalid-grant",
  );

  return {
    success,
    wrongStateDenied,
    wrongPkceDenied,
    wrongNonceDenied,
    replayDenied,
    expiredCodeDenied,
  };
}
