type PublicAuthOutcome = Readonly<{
  status: number;
  body: unknown;
  setCookies?: readonly string[];
}>;

type EnumerationDifference =
  | "status-differs"
  | "body-differs"
  | "cookie-shape-differs";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function cookieNames(cookies: readonly string[] | undefined): string[] {
  return (cookies ?? [])
    .map((cookie) => cookie.split(";", 1)[0]?.split("=", 1)[0]?.trim() ?? "")
    .sort();
}

export function assessEnumerationParity(
  existingAccount: PublicAuthOutcome,
  missingAccount: PublicAuthOutcome,
): { accepted: true } | { accepted: false; reason: EnumerationDifference } {
  if (existingAccount.status !== missingAccount.status) {
    return { accepted: false, reason: "status-differs" };
  }
  if (canonicalJson(existingAccount.body) !== canonicalJson(missingAccount.body)) {
    return { accepted: false, reason: "body-differs" };
  }
  if (
    canonicalJson(cookieNames(existingAccount.setCookies)) !==
    canonicalJson(cookieNames(missingAccount.setCookies))
  ) {
    return { accepted: false, reason: "cookie-shape-differs" };
  }
  return { accepted: true };
}

type PurposeBoundLinkConfiguration = Readonly<{
  expectedOrigin: string;
  expectedPath: string;
  secretParameter: string;
}>;

type PurposeBoundLinkReason =
  | "invalid-configuration"
  | "invalid-link"
  | "origin-mismatch"
  | "path-mismatch"
  | "missing-secret"
  | "ambiguous-secret"
  | "unexpected-parameter"
  | "fragment-present"
  | "credentials-present";

// This inspects callback shape only. The maintained provider remains responsible
// for generating, validating, expiring, and consuming the one-time secret.
export function assessPurposeBoundEmailLink(
  value: string,
  configuration: PurposeBoundLinkConfiguration,
): { accepted: true } | { accepted: false; reason: PurposeBoundLinkReason } {
  let link: URL;
  try {
    if (
      new URL(configuration.expectedOrigin).origin !==
        configuration.expectedOrigin ||
      !configuration.expectedPath.startsWith("/") ||
      configuration.expectedPath.includes("?") ||
      configuration.expectedPath.includes("#") ||
      configuration.secretParameter.length === 0
    ) {
      return { accepted: false, reason: "invalid-configuration" };
    }
    link = new URL(value);
  } catch {
    return { accepted: false, reason: "invalid-link" };
  }

  if (link.origin !== configuration.expectedOrigin) {
    return { accepted: false, reason: "origin-mismatch" };
  }
  if (link.pathname !== configuration.expectedPath) {
    return { accepted: false, reason: "path-mismatch" };
  }
  if (link.hash !== "") {
    return { accepted: false, reason: "fragment-present" };
  }
  if (link.username !== "" || link.password !== "") {
    return { accepted: false, reason: "credentials-present" };
  }

  const secrets = link.searchParams.getAll(configuration.secretParameter);
  if (secrets.length === 0 || secrets[0] === "") {
    return { accepted: false, reason: "missing-secret" };
  }
  if (secrets.length !== 1) {
    return { accepted: false, reason: "ambiguous-secret" };
  }
  if ([...link.searchParams.keys()].some((key) => key !== configuration.secretParameter)) {
    return { accepted: false, reason: "unexpected-parameter" };
  }

  return { accepted: true };
}

type SecretPageHeaderReason =
  | "cacheable"
  | "referrer-policy-missing"
  | "referrer-policy-unsafe";

export function assessSecretPageHeaders(
  headers: Readonly<Record<string, string>>,
): { accepted: true } | { accepted: false; reason: SecretPageHeaderReason } {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const cacheDirectives = (normalized["cache-control"] ?? "")
    .split(",")
    .map((directive) => directive.trim().toLowerCase());
  if (!cacheDirectives.includes("no-store")) {
    return { accepted: false, reason: "cacheable" };
  }

  const referrerPolicy = normalized["referrer-policy"]?.trim().toLowerCase();
  if (!referrerPolicy) {
    return { accepted: false, reason: "referrer-policy-missing" };
  }
  if (referrerPolicy !== "no-referrer") {
    return { accepted: false, reason: "referrer-policy-unsafe" };
  }

  return { accepted: true };
}
