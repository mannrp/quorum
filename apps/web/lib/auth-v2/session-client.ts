"use client";

export type BrowserSession = Readonly<{
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}>;

type RevokeInput =
  | Readonly<{ scope: "ONE"; sessionId: string }>
  | Readonly<{ scope: "OTHERS" | "ALL" }>;

function parseSessions(value: unknown): BrowserSession[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Session projection is invalid.");
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).length !== 1 || !Array.isArray(envelope.sessions)) throw new Error("Session projection is invalid.");
  return envelope.sessions.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Session projection is invalid.");
    const row = item as Record<string, unknown>;
    if (
      Object.keys(row).sort().join(",") !== "createdAt,current,expiresAt,id" ||
      typeof row.id !== "string" || !row.id ||
      typeof row.createdAt !== "string" || Number.isNaN(Date.parse(row.createdAt)) ||
      typeof row.expiresAt !== "string" || Number.isNaN(Date.parse(row.expiresAt)) ||
      typeof row.current !== "boolean"
    ) throw new Error("Session projection is invalid.");
    return { id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt, current: row.current };
  });
}

export function createSessionClient(request: typeof globalThis.fetch = globalThis.fetch) {
  return {
    async list(): Promise<BrowserSession[]> {
      const response = await request("/api/v1/sessions", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Session list failed.");
      return parseSessions(await response.json());
    },
    async revoke(input: RevokeInput): Promise<{ revokedCurrent: boolean }> {
      const response = await request("/api/v1/sessions", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Session revocation failed.");
      const value = await response.json() as { revokedCurrent?: unknown };
      if (typeof value.revokedCurrent !== "boolean") throw new Error("Session revocation response is invalid.");
      return { revokedCurrent: value.revokedCurrent };
    },
  };
}

export const sessionClient = createSessionClient();