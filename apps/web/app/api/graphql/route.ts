import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuth } from "@/lib/auth/server";
import { DEMO_COOKIE_NAME, demoModeEnabled, isDemoPersona } from "@/lib/demo";

export const dynamic = "force-dynamic";

const DEFAULT_GRAPHQL_URL = "http://localhost:8080/graphql";

function graphqlUrl() {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_GRAPHQL_URL;
}

async function currentNeonJwt() {
  try {
    const result = await getAuth().token();
    if (result.error || !result.data?.token) {
      return "";
    }
    return result.data.token;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const legacyAuthRequired = request.headers.get("x-quorum-auth-required") === "true";
  const authMode = request.headers.get("x-quorum-auth-mode") || (legacyAuthRequired ? "required" : "none");
  const store = await cookies();
  const demoPersona = demoModeEnabled() ? store.get(DEMO_COOKIE_NAME)?.value : undefined;
  const token = authMode === "none" ? "" : await currentNeonJwt();

  if (authMode === "required" && !token && !isDemoPersona(demoPersona)) {
    return NextResponse.json(
      { errors: [{ message: "authentication required" }] },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (isDemoPersona(demoPersona)) {
    headers["x-quorum-demo-persona"] = demoPersona;
  }

  const response = await fetch(graphqlUrl(), {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
