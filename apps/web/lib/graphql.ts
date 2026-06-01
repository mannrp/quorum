"use client";

import { useCallback, useEffect, useState } from "react";

export const AUTH_TOKEN_KEY = "quorum.neonAuthToken";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

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

export async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>, token = getAuthToken()): Promise<T> {
  const endpoint = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/graphql";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  if (!payload.data) {
    throw new Error("GraphQL response did not include data");
  }
  return payload.data;
}

export function useGraphQL<T>(query: string, variables?: Record<string, unknown>, options?: { auth?: boolean; skip?: boolean }) {
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
      setError(err instanceof Error ? err.message : "Unknown GraphQL error");
    } finally {
      setLoading(false);
    }
  }, [query, variablesKey, options?.auth, options?.skip]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}

export async function uploadToSignedPost(file: File, signature: { url: string; fields: { name: string; value: string }[] }) {
  const body = new FormData();
  for (const field of signature.fields) {
    body.append(field.name, field.value);
  }
  body.append("file", file);
  const response = await fetch(signature.url, { method: "POST", body });
  if (!response.ok) {
    throw new Error(`Upload failed with HTTP ${response.status}`);
  }
}
