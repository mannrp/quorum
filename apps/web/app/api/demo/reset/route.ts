import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE_NAME, demoModeEnabled, isDemoPersona } from "@/lib/demo";

const DEFAULT_GRAPHQL_URL = "http://localhost:8080/graphql";

function apiBaseUrl() {
  const graphqlUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_GRAPHQL_URL;
  return graphqlUrl.replace(/\/graphql\/?$/, "");
}

export async function POST() {
  if (!demoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled" }, { status: 404 });
  }

  const store = await cookies();
  const persona = store.get(DEMO_COOKIE_NAME)?.value;
  if (!isDemoPersona(persona)) {
    return NextResponse.json({ error: "Demo persona required" }, { status: 401 });
  }

  const response = await fetch(`${apiBaseUrl()}/demo/reset`, {
    method: "POST",
    headers: {
      "x-quorum-demo-persona": persona,
    },
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
