"use client";

import { viewerClient } from "./auth-v2/viewer-client";

const privateRoutes = new Set(["/dashboard", "/inbox", "/notifications", "/onboarding"]);

export function requiresAuthenticatedSession(pathname: string): boolean {
  return privateRoutes.has(pathname) ||
    pathname.startsWith("/settings/") ||
    pathname === "/teams/new" ||
    /^\/teams\/[^/]+\/manage$/.test(pathname) ||
    pathname === "/projects/new" ||
    /^\/projects\/[^/]+\/(?:applications|edit)$/.test(pathname);
}

export async function authDestination(): Promise<string> {
  const result = await viewerClient.viewer();
  if (result.state === "unauthenticated") return "/auth/login";
  if (result.state === "unenrolled") return "/onboarding";
  if (result.viewer.onboardingState !== "COMPLETE" || !result.viewer.username || !result.viewer.displayName) {
    return "/settings/profile";
  }
  return "/dashboard";
}
