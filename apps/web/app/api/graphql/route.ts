import { NextResponse } from "next/server";
import { AuthenticationRequiredError } from "@/lib/internal-api/principal-client";
import { getInternalAssertionHeaders } from "@/lib/internal-api/principal-runtime";

export const dynamic = "force-dynamic";

function graphqlURL(): string {
  const raw = process.env.INTERNAL_API_BASE_URL?.trim();
  if (!raw) throw new Error("INTERNAL_API_BASE_URL is required.");
  const url = new URL(raw);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("INTERNAL_API_BASE_URL must contain only scheme, host, and optional port.");
  }
  return url.origin + "/graphql";
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ errors: [{ message: "JSON content type required" }] }, { status: 415 });
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 1 << 20) {
    return NextResponse.json({ errors: [{ message: "request too large" }] }, { status: 413 });
  }

  const mode = request.headers.get("x-quorum-auth-mode") ?? "none";
  let assertionHeaders: Record<string, string> = {};
  if (mode === "required" || mode === "optional") {
    try {
      assertionHeaders = await getInternalAssertionHeaders(request.headers);
    } catch (error) {
      if (mode === "required" && error instanceof AuthenticationRequiredError) {
        return NextResponse.json({ errors: [{ message: "authentication required" }] }, { status: 401 });
      }
      if (mode === "required") {
        return NextResponse.json({ errors: [{ message: "authentication unavailable" }] }, { status: 503 });
      }
    }
  }

  const response = await fetch(graphqlURL(), {
    method: "POST",
    headers: { "content-type": "application/json", ...assertionHeaders },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
      "cache-control": "private, no-store",
    },
  });
}
