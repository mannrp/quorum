"use client";

import { useCallback, useEffect, useState } from "react";

type OperationEnvelope<T> = Readonly<{
  data?: T;
  errors?: Array<Readonly<{ message: string }>>;
}>;
export function userFacingError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Operation failed.";
}

export function clearOperationCache(): void {
  // Registered operations do not retain a client-side cache.
}

export async function operationRequest<T>(
  operationId: string,
  variables: Record<string, unknown>,
  request: typeof globalThis.fetch = globalThis.fetch,
): Promise<T> {
  const response = await request(`/api/v1/operations/${encodeURIComponent(operationId)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(variables),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Operation failed with HTTP ${response.status}`);
  const envelope = await response.json() as OperationEnvelope<T>;
  if (envelope.errors?.length) throw new Error(envelope.errors.map((error) => error.message).join("; "));
  if (!envelope.data) throw new Error("Operation response did not include data.");
  return envelope.data;
}

export function useOperation<T>(
  operationId: string,
  variables: Record<string, unknown>,
  debounceMs = 0,
) {
  const variablesKey = JSON.stringify(variables);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await operationRequest<T>(operationId, JSON.parse(variablesKey) as Record<string, unknown>));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setLoading(false);
    }
  }, [operationId, variablesKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, load]);

  return { data, error, loading, reload: load };
}