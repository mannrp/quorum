export type AccountMethodRecord = Readonly<{ providerId?: unknown }>;

export function isRecentSession(createdAt: Date | string | undefined, freshSeconds: number, now = new Date()): boolean {
  if (!createdAt || !Number.isFinite(freshSeconds) || freshSeconds <= 0) return false;
  const created = new Date(createdAt).getTime();
  const current = now.getTime();
  return Number.isFinite(created) && Number.isFinite(current) && current >= created && current - created < freshSeconds * 1_000;
}

export function projectAccountMethods(value: unknown): Array<{ providerId: string }> {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["credential", "google", "quorum-test-oidc"]);
  const providers = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const providerId = (entry as AccountMethodRecord).providerId;
    if (typeof providerId === "string" && allowed.has(providerId)) providers.add(providerId);
  }
  return [...providers].sort().map((providerId) => ({ providerId }));
}