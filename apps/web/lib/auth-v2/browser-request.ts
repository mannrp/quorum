import "server-only";
import type { SelfServiceRole } from "./viewer-contract";

export async function readEnrollmentRequest(request: Request, canonicalOrigin: string): Promise<SelfServiceRole> {
  if (request.headers.get("origin") !== new URL(canonicalOrigin).origin) {
    throw new Error("Request origin rejected.");
  }
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    throw new Error("Cross-site request rejected.");
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new Error("JSON content type is required.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 1_024) {
    throw new Error("Enrollment request is too large.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Enrollment request is invalid.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Enrollment request is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || (record.role !== "STUDENT" && record.role !== "SPONSOR")) {
    throw new Error("Enrollment role is invalid.");
  }
  return record.role;
}
