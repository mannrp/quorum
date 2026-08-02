import { NextResponse } from "next/server";
import { readSameOriginJSON } from "@/lib/auth-v2/browser-request";
import { AuthenticationRequiredError } from "@/lib/internal-api/principal-client";
import { getAnonymousAssertionHeaders, getInternalAssertionHeaders } from "@/lib/internal-api/principal-runtime";
import { internalAPIRequest } from "@/lib/internal-api/request";
import { resolveOperation } from "@/lib/operations/registry";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ operationId: string }> },
): Promise<Response> {
  try {
    const { operationId } = await context.params;
    const variables = await readSameOriginJSON(request, process.env.BETTER_AUTH_URL ?? "");
    const operation = resolveOperation(operationId, variables);
    const assertionHeaders = operation.auth === "anonymous"
      ? await getAnonymousAssertionHeaders()
      : await getInternalAssertionHeaders(request.headers);
    const response = await internalAPIRequest("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...assertionHeaders },
      body: JSON.stringify({ query: operation.document, variables: operation.variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    const message = error instanceof Error && error.message === "Operation is not registered."
      ? "operation_not_found"
      : "invalid_operation_request";
    return NextResponse.json({ error: message }, { status: message === "operation_not_found" ? 404 : 400 });
  }
}