"use client";

import { authClient } from "./client";

function authErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Authentication request failed.";
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) throw new Error(authErrorMessage(result.error));
}

export async function signInWithGoogle(): Promise<void> {
  const callbacks = {
    callbackURL: "/auth/complete",
    newUserCallbackURL: "/auth/complete",
    errorCallbackURL: "/auth/login?oauth=error",
  } as const;
  const result = process.env.NEXT_PUBLIC_AUTH_TEST_OIDC === "true"
    ? await authClient.signIn.oauth2({ providerId: "quorum-test-oidc", ...callbacks })
    : await authClient.signIn.social({ provider: "google", ...callbacks });
  if (result.error) throw new Error(authErrorMessage(result.error));
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<void> {
  const result = await authClient.signUp.email({ email, password, name, callbackURL: "/auth/complete" });
  if (result.error) throw new Error(authErrorMessage(result.error));
}

export async function getCurrentUser() {
  const result = await authClient.getSession();
  if (result.error) throw new Error(authErrorMessage(result.error));
  return result.data?.user ?? null;
}

export async function signOut(): Promise<void> {
  const result = await authClient.signOut();
  if (result.error) throw new Error(authErrorMessage(result.error));
}
