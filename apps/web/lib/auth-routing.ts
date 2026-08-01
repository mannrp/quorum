"use client";

import { viewerClient } from "./auth-v2/viewer-client";

export async function authDestination(): Promise<string> {
  const result = await viewerClient.viewer();
  if (result.state === "unauthenticated") return "/auth/login";
  if (result.state === "unenrolled") return "/onboarding";
  return "/dashboard";
}
