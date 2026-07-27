export type MutationOriginAssessment =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "invalid-expected-origin"
        | "missing-origin"
        | "invalid-origin"
        | "origin-mismatch"
        | "cross-site";
    };

type MutationRequestMetadata = Readonly<{
  origin?: string;
  secFetchSite?: string;
}>;

function isCanonicalOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

export function assessMutationOrigin(
  request: MutationRequestMetadata,
  expectedOrigin: string,
): MutationOriginAssessment {
  if (!isCanonicalOrigin(expectedOrigin)) {
    return { allowed: false, reason: "invalid-expected-origin" };
  }
  if (!request.origin) {
    return { allowed: false, reason: "missing-origin" };
  }
  if (!isCanonicalOrigin(request.origin)) {
    return { allowed: false, reason: "invalid-origin" };
  }
  if (request.origin !== expectedOrigin) {
    return { allowed: false, reason: "origin-mismatch" };
  }
  if (request.secFetchSite?.toLowerCase() === "cross-site") {
    return { allowed: false, reason: "cross-site" };
  }

  return { allowed: true };
}

export type SessionCookieAssessment =
  | { accepted: true }
  | {
      accepted: false;
      reason:
        | "missing-host-prefix"
        | "missing-secure"
        | "missing-http-only"
        | "invalid-path"
        | "domain-present"
        | "invalid-same-site";
    };

export function assessSessionCookie(cookie: string): SessionCookieAssessment {
  const [nameValue = "", ...rawAttributes] = cookie.split(";");
  const name = nameValue.trim().split("=", 1)[0];
  const attributes = rawAttributes.map((attribute) => attribute.trim().toLowerCase());

  if (!name.startsWith("__Host-")) {
    return { accepted: false, reason: "missing-host-prefix" };
  }
  if (!attributes.includes("secure")) {
    return { accepted: false, reason: "missing-secure" };
  }
  if (!attributes.includes("httponly")) {
    return { accepted: false, reason: "missing-http-only" };
  }
  if (!attributes.includes("path=/")) {
    return { accepted: false, reason: "invalid-path" };
  }
  if (attributes.some((attribute) => attribute.startsWith("domain="))) {
    return { accepted: false, reason: "domain-present" };
  }
  if (
    !attributes.some(
      (attribute) => attribute === "samesite=lax" || attribute === "samesite=strict",
    )
  ) {
    return { accepted: false, reason: "invalid-same-site" };
  }

  return { accepted: true };
}
