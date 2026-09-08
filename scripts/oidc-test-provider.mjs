import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const hostname = "127.0.0.1";
const port = Number.parseInt(process.env.OIDC_TEST_PORT ?? "19090", 10);
const issuer = `http://${hostname}:${port}`;
const clientId = process.env.OIDC_TEST_CLIENT_ID ?? "quorum-test-client";
const clientSecret = process.env.OIDC_TEST_CLIENT_SECRET ?? "quorum-test-secret";
const subject = process.env.OIDC_TEST_SUBJECT ?? "deterministic-google-subject";
const expectedRedirectURI = process.env.OIDC_TEST_REDIRECT_URI ?? "http://127.0.0.1:3000/api/auth/oauth2/callback/quorum-test-oidc";
const codes = new Map();
const accessTokens = new Set();
const identitySuffix = randomBytes(8).toString("hex");
let lastAuthorization;
let userInfoRequests = 0;

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

function reject(response, status, error) {
  json(response, status, { error });
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

async function form(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", issuer);

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json(response, 200, { status: "ok" });
  }

  if (request.method === "GET" && url.pathname === "/authorize") {
    const redirectURI = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    const challenge = url.searchParams.get("code_challenge");
    const challengeMethod = url.searchParams.get("code_challenge_method");
    const scope = url.searchParams.get("scope") ?? "";
    if (
      url.searchParams.get("client_id") !== clientId ||
      url.searchParams.get("response_type") !== "code" ||
      redirectURI !== expectedRedirectURI ||
      !state ||
      !challenge ||
      challengeMethod !== "S256"
    ) {
      return reject(response, 400, "invalid_authorization_request");
    }

    const code = randomBytes(24).toString("base64url");
    codes.set(code, { challenge, redirectURI });
    lastAuthorization = { redirectURI, challengeMethod, scope, issuer };
    const callback = new URL(redirectURI);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    callback.searchParams.set("iss", issuer);
    response.writeHead(302, { location: callback.toString(), "cache-control": "no-store" });
    return response.end();
  }

  if (request.method === "POST" && url.pathname === "/token") {
    const body = await form(request);
    const code = body.get("code");
    const record = code ? codes.get(code) : undefined;
    if (
      body.get("client_id") !== clientId ||
      body.get("client_secret") !== clientSecret ||
      body.get("grant_type") !== "authorization_code" ||
      body.get("redirect_uri") !== expectedRedirectURI ||
      !record ||
      record.redirectURI !== expectedRedirectURI ||
      digest(body.get("code_verifier") ?? "") !== record.challenge
    ) {
      return reject(response, 400, "invalid_grant");
    }

    codes.delete(code);
    const accessToken = randomBytes(24).toString("base64url");
    accessTokens.add(accessToken);
    return json(response, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid email profile",
    });
  }

  if (request.method === "GET" && url.pathname === "/userinfo") {
    const authorization = request.headers.authorization ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessTokens.has(token)) return reject(response, 401, "invalid_token");
    userInfoRequests += 1;
    const returning = userInfoRequests > 1;
    return json(response, 200, {
      sub: subject,
      email: returning ? `oidc-renamed-${identitySuffix}@example.test` : `oidc-${identitySuffix}@example.test`,
      email_verified: true,
      name: returning ? "OIDC Renamed User" : "OIDC Test User",
    });
  }

  if (request.method === "GET" && url.pathname === "/last") {
    return json(response, 200, {
      authorization: lastAuthorization ?? null,
      pendingAuthorizationCodes: codes.size,
      issuedAccessTokens: accessTokens.size,
      userInfoRequests,
    });
  }

  return reject(response, 404, "not_found");
});

server.listen(port, hostname);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    await close();
    process.exit(0);
  });
}
