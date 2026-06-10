"use client";

import { graphqlRequest } from "./graphql";
import { AUTH_STATE_QUERY } from "./queries";
import type { AuthState } from "@/types/domain";

export async function authDestination() {
  const result = await graphqlRequest<{ authState: AuthState }>(AUTH_STATE_QUERY, {}, { auth: true });
  const state = result.authState;
  if (!state.authenticated) {
    return "/auth/login";
  }
  if (!state.hasProfile || !state.profileComplete) {
    return "/onboarding";
  }
  return "/dashboard";
}
