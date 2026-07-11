"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

type GraphQLRequestOptions = {
  auth?: boolean | "optional";
  signal?: AbortSignal;
  cacheMs?: number;
  force?: boolean;
};

type QueryCacheEntry = {
  data: unknown;
  updatedAt: number;
};

const queryCache = new Map<string, QueryCacheEntry>();
const queriesInFlight = new Map<string, Promise<unknown>>();
const DEFAULT_QUERY_CACHE_MS = 60_000;

function queryCacheKey(query: string, variables: Record<string, unknown>, auth: boolean | "optional" = false) {
  return JSON.stringify([query, variables, auth]);
}

export function clearGraphQLCache() {
  queryCache.clear();
  queriesInFlight.clear();
}

export function getCachedGraphQLData<T>(
  query: string,
  variables: Record<string, unknown> = {},
  auth: boolean | "optional" = false
) {
  return queryCache.get(queryCacheKey(query, variables, auth))?.data as T | undefined;
}

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

function graphqlUrl() {
  return process.env.NEXT_PUBLIC_GRAPHQL_PROXY_URL || "/api/graphql";
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
  options?: GraphQLRequestOptions
): Promise<T> {
  const normalizedVariables = variables || {};
  const cacheKey = queryCacheKey(query, normalizedVariables, options?.auth);
  const cacheMs = options?.cacheMs ?? 0;
  const cached = queryCache.get(cacheKey);
  if (!options?.force && cacheMs > 0 && cached && Date.now() - cached.updatedAt < cacheMs) {
    return cached.data as T;
  }
  if (!options?.force && !options?.signal) {
    const pending = queriesInFlight.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (options?.auth) {
    headers["x-quorum-auth-mode"] = options.auth === true ? "required" : "optional";
  }

  let response: Response;
  try {
    response = await fetch(graphqlUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: normalizedVariables }),
      cache: "no-store",
      signal: options?.signal
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
  if (/^\s*mutation\b/.test(query)) {
    clearGraphQLCache();
  }
  if (cacheMs > 0) {
    queryCache.set(cacheKey, { data: payload.data, updatedAt: Date.now() });
  }
  return payload.data;
  })();

  if (!options?.signal) {
    queriesInFlight.set(cacheKey, request);
  }
  try {
    return await request;
  } finally {
    if (queriesInFlight.get(cacheKey) === request) {
      queriesInFlight.delete(cacheKey);
    }
  }
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
  options?: { auth?: boolean | "optional"; skip?: boolean; debounceMs?: number }
) {
  const variablesKey = JSON.stringify(variables || {});
  const cacheKey = queryCacheKey(query, JSON.parse(variablesKey) as Record<string, unknown>, options?.auth);
  const initialCached = queryCache.get(cacheKey)?.data as T | undefined;
  const [data, setData] = useState<T | null>(initialCached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!options?.skip && !initialCached);
  const [isFetching, setIsFetching] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (signal?: AbortSignal, force = false) => {
    if (options?.skip) return;
    const parsedVariables = JSON.parse(variablesKey) as Record<string, unknown>;
    const key = queryCacheKey(query, parsedVariables, options?.auth);
    const cached = queryCache.get(key);
    if (!force && cached && Date.now() - cached.updatedAt < DEFAULT_QUERY_CACHE_MS) {
      setData(cached.data as T);
      setLoading(false);
      return;
    }
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setLoading(!cached);
    setIsFetching(true);
    setError(null);
    try {
      if (cached) setData(cached.data as T);
      const result = await graphqlRequest<T>(query, parsedVariables, {
        auth: options?.auth,
        signal,
        cacheMs: DEFAULT_QUERY_CACHE_MS,
        force,
      });
      if (requestSeq.current === requestId && !signal?.aborted) {
        setData(result);
      }
    } catch (err) {
      if (!signal?.aborted && requestSeq.current === requestId) {
        setError(userFacingError(err));
      }
    } finally {
      if (!signal?.aborted && requestSeq.current === requestId) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  }, [query, variablesKey, options?.auth, options?.skip]);

  useEffect(() => {
    const controller = new AbortController();
    const debounceMs = options?.debounceMs ?? 0;
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, options?.debounceMs]);

  return { data, error, loading, isFetching, reload: () => load(undefined, true) };
}
