export type SelfServiceRole = "STUDENT" | "SPONSOR";

export type ViewerBootstrapV1 = Readonly<{
  productUserId: string;
  accountState: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "DELETED";
  onboardingState: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  username: string | null;
  displayName: string | null;
  selfServiceRoles: SelfServiceRole[];
}>;

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseViewerEnvelope(value: unknown): ViewerBootstrapV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid viewer projection.");
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).length !== 1 || !envelope.viewer || typeof envelope.viewer !== "object" || Array.isArray(envelope.viewer)) {
    throw new Error("Invalid viewer projection.");
  }
  const viewer = envelope.viewer as Record<string, unknown>;
  const expected = ["productUserId", "accountState", "onboardingState", "username", "displayName", "selfServiceRoles"];
  if (Object.keys(viewer).sort().join(",") !== [...expected].sort().join(",")) throw new Error("Invalid viewer projection.");
  if (
    typeof viewer.productUserId !== "string" ||
    !["ACTIVE", "SUSPENDED", "DEACTIVATED", "DELETED"].includes(String(viewer.accountState)) ||
    !["NOT_STARTED", "IN_PROGRESS", "COMPLETE"].includes(String(viewer.onboardingState)) ||
    (viewer.username !== null && typeof viewer.username !== "string") ||
    (viewer.displayName !== null && typeof viewer.displayName !== "string") ||
    !stringArray(viewer.selfServiceRoles) ||
    viewer.selfServiceRoles.some((role) => role !== "STUDENT" && role !== "SPONSOR")
  ) {
    throw new Error("Invalid viewer projection.");
  }
  return viewer as ViewerBootstrapV1;
}
