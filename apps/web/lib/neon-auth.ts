"use client";

import { setAuthToken } from "./graphql";
import { authClient } from "./auth/client";

function authErrorMessage(error: unknown) {
  if (!error) return "Neon Auth request failed.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Neon Auth request failed.";
}

export async function syncCurrentNeonJwt() {
  const result = await authClient.token();
  if (result.error || !result.data?.token) {
    throw new Error(authErrorMessage(result.error) || "Neon Auth did not return a session token.");
  }

  setAuthToken(result.data.token);
  return result.data.token;
}

export async function signInWithNeonEmail(email: string, password: string) {
  const result = await authClient.signIn.email({ email, password });
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
  return syncCurrentNeonJwt();
}

export async function signUpWithNeonEmail(email: string, password: string, name: string) {
  const result = await authClient.signUp.email({ email, password, name });
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
  return syncCurrentNeonJwt();
}

export async function signInWithNeonOAuth(provider: "google" | "github", callbackURL: string) {
  const result = await authClient.signIn.social({ provider, callbackURL });
  if (result.error) {
    throw new Error(authErrorMessage(result.error));
  }
}

export async function signOutOfNeonAuth() {
  await authClient.signOut();
  setAuthToken("");
}
