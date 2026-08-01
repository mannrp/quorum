export function isWithinAbsoluteLifetime(value: Date | string | undefined, now = new Date()): boolean {
  if (!value) return false;
  const deadline = new Date(value).getTime();
  const current = now.getTime();
  return Number.isFinite(deadline) && Number.isFinite(current) && current < deadline;
}