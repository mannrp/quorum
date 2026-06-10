"use client";

import { authClient } from "./auth/client";

function authErrorMessage(error: unknown) {
  if (!error) return "Neon Auth request failed.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Neon Auth request failed.";
}

export async function signInWithNeonEmail(email: string, password: string) {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
}

export async function signUpWithNeonEmail(email: string, password: string, name: string) {
  const result = await authClient.signUp.email({ email, password, name });
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
}

export async function signInWithNeonOAuth(provider: "google", callbackURL: string) {
  const result = await authClient.signIn.social({
    provider,
    callbackURL,
    newUserCallbackURL: callbackURL,
    errorCallbackURL: "/auth/login",
  });
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
}

export async function getCurrentNeonUser() {
  const result = await authClient.getSession();
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
  return result.data?.user || null;
}

export async function signOutOfNeonAuth() {
  await authClient.signOut();
}
