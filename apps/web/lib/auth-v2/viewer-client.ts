"use client";

import { parseViewerEnvelope, type SelfServiceRole } from "./viewer-contract";

export function createViewerClient(request: typeof globalThis.fetch = globalThis.fetch) {
  return {
    async viewer() {
      const response = await request("/api/v1/viewer", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) return { state: "unauthenticated" as const };
      if (response.status === 404) return { state: "unenrolled" as const };
      if (!response.ok) throw new Error("Viewer request failed.");
      return { state: "ready" as const, viewer: parseViewerEnvelope(await response.json()) };
    },
    async enroll(role: SelfServiceRole) {
      const response = await request("/api/v1/enrollment", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Enrollment request failed.");
      return parseViewerEnvelope(await response.json());
    },
  };
}

export const viewerClient = createViewerClient();
