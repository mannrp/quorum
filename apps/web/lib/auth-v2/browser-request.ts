import "server-only";
import type { SelfServiceRole } from "./viewer-contract";

export async function readSameOriginJSON(
  request: Request,
  canonicalOrigin: string,
  maximumBytes = 1_024,
): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") !== new URL(canonicalOrigin).origin) throw new Error("Request origin rejected.");
  if (request.headers.get("sec-fetch-site") !== "same-origin") throw new Error("Cross-site request rejected.");
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("JSON content type is required.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error("Request is too large.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Request is invalid.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request is invalid.");
  return value as Record<string, unknown>;
}

export async function readEnrollmentRequest(request: Request, canonicalOrigin: string): Promise<SelfServiceRole> {
  const record = await readSameOriginJSON(request, canonicalOrigin);
  if (Object.keys(record).length !== 1 || (record.role !== "STUDENT" && record.role !== "SPONSOR")) {
    throw new Error("Enrollment role is invalid.");
  }
  return record.role;
}

export type SessionRevocationRequest =
  | Readonly<{ scope: "ONE"; sessionId: string }>
  | Readonly<{ scope: "OTHERS" | "ALL" }>;

export async function readSessionRevocationRequest(
  request: Request,
  canonicalOrigin: string,
): Promise<SessionRevocationRequest> {
  const record = await readSameOriginJSON(request, canonicalOrigin);
  if (
    record.scope === "ONE" &&
    Object.keys(record).length === 2 &&
    typeof record.sessionId === "string" &&
    record.sessionId.length > 0 &&
    record.sessionId.length <= 256
  ) {
    return { scope: "ONE", sessionId: record.sessionId };
  }
  if ((record.scope === "OTHERS" || record.scope === "ALL") && Object.keys(record).length === 1) {
    return { scope: record.scope };
  }
  throw new Error("Session revocation request is invalid.");
}