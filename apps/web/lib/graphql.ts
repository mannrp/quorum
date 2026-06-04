"use client";

import { useCallback, useEffect, useState } from "react";

export const AUTH_TOKEN_KEY = "quorum.neonAuthToken";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export type GraphQLClientErrorKind =
  | "auth"
  | "permission"
  | "deadline"
  | "duplicate"
  | "http"
  | "network"
  | "unknown";

export class GraphQLClientError extends Error {
  readonly kind: GraphQLClientErrorKind;
  readonly status?: number;

  constructor(message: string, kind: GraphQLClientErrorKind, status?: number) {
    super(message);
    this.name = "GraphQLClientError";
    this.kind = kind;
    this.status = status;
  }
}

const DEFAULT_GRAPHQL_URL = "http://localhost:8080/graphql";

function graphqlUrl() {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_GRAPHQL_URL;
}

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  const trimmed = token.trim();
  if (trimmed) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, trimmed);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function classifyGraphQLError(message: string, status?: number): GraphQLClientErrorKind {
  const normalized = message.toLowerCase();
  if (status === 401 || normalized.includes("authentication required") || normalized.includes("invalid bearer") || normalized.includes("token expired")) {
    return "auth";
  }
  if (status === 403 || normalized.includes("access required") || normalized.includes("not authorized") || normalized.includes("permission")) {
    return "permission";
  }
  if (normalized.includes("deadline has passed") || normalized.includes("expired") || normalized.includes("not accepting")) {
    return "deadline";
  }
  if (normalized.includes("already") || normalized.includes("duplicate")) {
    return "duplicate";
  }
  if (status) {
    return "http";
  }
  return "unknown";
}

export function userFacingError(error: unknown): string {
  if (error instanceof GraphQLClientError) {
    switch (error.kind) {
      case "auth":
        return "Your session has expired or is no longer valid. Please sign in again.";
      case "permission":
        return "You do not have permission to perform this action.";
      case "deadline":
        return error.message;
      case "duplicate":
        return error.message;
      case "network":
        return "Quorum could not reach the backend. Please try again when the API is available.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Unknown GraphQL error";
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token = getAuthToken()
): Promise<T> {
  const headers: HeadersInit = {
    "content-type": "application/json"
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(graphqlUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: variables || {} }),
      cache: "no-store"
    });
  } catch (err) {
    throw new GraphQLClientError(err instanceof Error ? err.message : "Network request failed", "network");
  }

  if (!response.ok) {
    const message = `GraphQL request failed with HTTP ${response.status}`;
    throw new GraphQLClientError(message, classifyGraphQLError(message, response.status), response.status);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    const message = payload.errors.map((error) => error.message).join("; ");
    throw new GraphQLClientError(message, classifyGraphQLError(message));
  }
  if (!payload.data) {
    throw new GraphQLClientError("GraphQL response did not include data", "unknown");
  }
  return payload.data;
}

export async function uploadToSignedPost(
  file: File,
  signature: { url: string; fields: { name: string; value: string }[] }
) {
  const form = new FormData();
  for (const field of signature.fields) {
    form.append(field.name, field.value);
  }
  form.append("file", file);

  const response = await fetch(signature.url, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(`Upload failed with HTTP ${response.status}`);
  }
}

export function useGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { auth?: boolean; skip?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const variablesKey = JSON.stringify(variables || {});

  const load = useCallback(async () => {
    if (options?.skip) return;
    setLoading(true);
    setError(null);
    try {
      const parsedVariables = JSON.parse(variablesKey) as Record<string, unknown>;
      setData(await graphqlRequest<T>(query, parsedVariables, options?.auth ? getAuthToken() : undefined));
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [query, variablesKey, options?.auth, options?.skip]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}
