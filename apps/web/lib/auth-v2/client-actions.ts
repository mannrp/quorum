"use client";

import { authClient } from "./client";
import { publishSessionInvalidated } from "./session-events";

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

export async function signUpWithEmail(email: string, password: string, name: string): Promise<"authenticated" | "verification-required"> {
  const result = await authClient.signUp.email({ email, password, name, callbackURL: "/auth/complete" });
  if (result.error) throw new Error(authErrorMessage(result.error));
  const session = await authClient.getSession();
  if (session.error) throw new Error(authErrorMessage(session.error));
  return session.data ? "authenticated" : "verification-required";
}

export async function getCurrentUser() {
  const result = await authClient.getSession();
  if (result.error) throw new Error(authErrorMessage(result.error));
  return result.data?.user ?? null;
}

export async function signOut(): Promise<void> {
  const result = await authClient.signOut();
  if (result.error) throw new Error(authErrorMessage(result.error));
  publishSessionInvalidated();
}
export type SignInMethod = "password" | "google";

export async function listSignInMethods(): Promise<SignInMethod[]> {
  const result = await authClient.listAccounts();
  if (result.error) throw new Error(authErrorMessage(result.error));
  const methods = new Set<SignInMethod>();
  for (const account of result.data ?? []) {
    if (account.providerId === "credential") methods.add("password");
    if (account.providerId === "google" || account.providerId === "quorum-test-oidc") methods.add("google");
  }
  return (["password", "google"] as const).filter((method) => methods.has(method));
}

export async function linkGoogle(): Promise<void> {
  if (process.env.NEXT_PUBLIC_AUTH_TEST_OIDC === "true") {
    throw new Error("Google linking is unavailable in the deterministic browser harness.");
  }
  const result = await authClient.linkSocial({
    provider: "google",
    callbackURL: "/settings/account?linked=google",
    errorCallbackURL: "/settings/account?link=error",
  });
  if (result.error) throw new Error(authErrorMessage(result.error));
}

export async function unlinkGoogle(): Promise<void> {
  const result = await authClient.unlinkAccount({
    providerId: process.env.NEXT_PUBLIC_AUTH_TEST_OIDC === "true" ? "quorum-test-oidc" : "google",
  });
  if (result.error) throw new Error(authErrorMessage(result.error));
}
export async function requestPasswordResetEmail(email: string): Promise<void> {
  const result = await authClient.requestPasswordReset({ email, redirectTo: "/auth/reset-password" });
  if (result.error) throw new Error(authErrorMessage(result.error));
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const result = await authClient.resetPassword({ token, newPassword });
  if (result.error) throw new Error(authErrorMessage(result.error));
}
export async function changeCurrentPassword(currentPassword: string, newPassword: string): Promise<void> {
  const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
  if (result.error) throw new Error(authErrorMessage(result.error));
  publishSessionInvalidated();
}

export async function requestEmailChange(newEmail: string): Promise<void> {
  const result = await authClient.changeEmail({ newEmail, callbackURL: "/settings/account?email=changed" });
  if (result.error) throw new Error(authErrorMessage(result.error));
}
