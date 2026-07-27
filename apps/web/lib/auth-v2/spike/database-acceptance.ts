export type AuthCatalogObject = Readonly<{
  schema: string;
  name: string;
  kind: string;
}>;

export type AuthSchemaSnapshot = Readonly<{
  searchPath: readonly string[];
  objects: readonly AuthCatalogObject[];
}>;

function catalogObjectKey(object: AuthCatalogObject): string {
  return `${object.schema}\u0000${object.kind}\u0000${object.name}`;
}

export function createdCatalogObjects(
  before: readonly AuthCatalogObject[],
  after: readonly AuthCatalogObject[],
): AuthCatalogObject[] {
  const existing = new Set(before.map(catalogObjectKey));
  return after.filter((object) => !existing.has(catalogObjectKey(object)));
}

type SchemaIsolationReason =
  | "unsafe-search-path"
  | "empty-schema"
  | "object-in-reserved-auth"
  | "object-outside-better-auth";

export function assessAuthSchemaIsolation(
  snapshot: AuthSchemaSnapshot,
): { accepted: true } | { accepted: false; reason: SchemaIsolationReason } {
  const expectedSearchPath = ["better_auth", "pg_catalog", "pg_temp"];
  if (
    snapshot.searchPath.length !== expectedSearchPath.length ||
    snapshot.searchPath.some(
      (schema, index) => schema !== expectedSearchPath[index],
    )
  ) {
    return { accepted: false, reason: "unsafe-search-path" };
  }
  if (snapshot.objects.length === 0) {
    return { accepted: false, reason: "empty-schema" };
  }
  if (snapshot.objects.some((object) => object.schema === "auth")) {
    return { accepted: false, reason: "object-in-reserved-auth" };
  }
  if (snapshot.objects.some((object) => object.schema !== "better_auth")) {
    return { accepted: false, reason: "object-outside-better-auth" };
  }

  return { accepted: true };
}

type StoredSessionCredentialEvidence = Readonly<{
  // Acceptance code fingerprints values in memory and records only equality.
  // Neither fingerprint nor source credential belongs in STATUS evidence.
  browserCredentialFingerprint: string;
  storedValueFingerprint: string;
  storedValueForm: "one-way-digest" | "plaintext-or-reversible" | "unknown";
  readableByApplicationRole: boolean;
}>;

type StoredCredentialRejection =
  | "application-role-can-read"
  | "storage-form-unknown"
  | "digest-matches-browser-credential"
  | "reusable-value-needs-risk-decision";

export function assessStoredSessionCredential(
  evidence: StoredSessionCredentialEvidence,
):
  | { accepted: true; disposition: "digest" }
  | { accepted: false; reason: StoredCredentialRejection } {
  if (evidence.readableByApplicationRole) {
    return { accepted: false, reason: "application-role-can-read" };
  }
  if (evidence.storedValueForm === "unknown") {
    return { accepted: false, reason: "storage-form-unknown" };
  }
  if (evidence.storedValueForm === "plaintext-or-reversible") {
    return {
      accepted: false,
      reason: "reusable-value-needs-risk-decision",
    };
  }
  if (
    evidence.browserCredentialFingerprint === evidence.storedValueFingerprint
  ) {
    return { accepted: false, reason: "digest-matches-browser-credential" };
  }

  return { accepted: true, disposition: "digest" };
}
