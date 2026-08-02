import "server-only";
import { request as httpRequest } from "node:http";

type InternalInput = string | URL | Request;

function socketPath(): string | undefined {
  const value = process.env.INTERNAL_API_SOCKET_PATH?.trim();
  return value || undefined;
}

function baseURL(): string {
  const raw = process.env.INTERNAL_API_BASE_URL?.trim();
  if (!raw) throw new Error("INTERNAL_API_BASE_URL is required when INTERNAL_API_SOCKET_PATH is not set.");
  const url = new URL(raw);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("INTERNAL_API_BASE_URL must contain only scheme, host, and optional port.");
  }
  return url.origin;
}

export function internalAPIBaseURL(): string {
  if (socketPath()) return "http://quorum.internal";
  if (process.env.NODE_ENV === "production") {
    throw new Error("INTERNAL_API_SOCKET_PATH is required in production.");
  }
  return baseURL();
}

function requestPath(input: InternalInput): string {
  const raw = input instanceof Request ? input.url : input.toString();
  const url = new URL(raw, internalAPIBaseURL());
  if (url.origin !== internalAPIBaseURL()) throw new Error("Internal API request target is not allowed.");
  return url.pathname + url.search;
}

export async function internalAPIRequest(input: InternalInput, init?: RequestInit): Promise<Response> {
  const path = requestPath(input);
  const socket = socketPath();
  if (!socket) return globalThis.fetch(internalAPIBaseURL() + path, init);

  const body = init?.body;
  if (body !== undefined && typeof body !== "string" && !(body instanceof Uint8Array)) {
    throw new Error("Internal API requests require a string or byte body.");
  }
  const headers = new Headers(init?.headers);
  if (!headers.has("Host")) headers.set("Host", "quorum.internal");

  return new Promise<Response>((resolve, reject) => {
    const request = httpRequest({
      socketPath: socket,
      path,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(headers.entries()),
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode ?? 502,
        statusText: response.statusMessage,
        headers: response.headers as HeadersInit,
      })));
    });
    request.on("error", reject);
    init?.signal?.addEventListener("abort", () => request.destroy(init.signal?.reason), { once: true });
    if (body !== undefined) request.write(body);
    request.end();
  });
}
