"use client";

import { StackClientApp } from "@stackframe/stack";
import { setAuthToken } from "./graphql";

const missingStackValue = "replace-with";
const placeholderProjectId = "00000000-0000-4000-8000-000000000000";

function stackProjectId() {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "";
  return projectId.includes(missingStackValue) || !projectId ? placeholderProjectId : projectId;
}

export const stackApp = new StackClientApp({
  projectId: stackProjectId(),
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || "",
  tokenStore: "cookie",
});

export function isStackConfigured() {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "";
  const publishableKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || "";
  return Boolean(projectId && publishableKey && !projectId.includes(missingStackValue) && !publishableKey.includes(missingStackValue));
}

export async function syncStackAccessToken(app = stackApp) {
  const token = await app.getAccessToken();
  if (!token) {
    setAuthToken("");
    throw new Error("Neon Auth did not return a session token. Check email verification and Stack Auth configuration.");
  }
  setAuthToken(token);
  return token;
}
