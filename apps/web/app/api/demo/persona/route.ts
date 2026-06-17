import { NextResponse } from "next/server";
import { DEMO_COOKIE_NAME, DEMO_PERSONAS, demoModeEnabled, isDemoPersona } from "@/lib/demo";

export async function POST(request: Request) {
  if (!demoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled" }, { status: 404 });
  }

  let persona: unknown;
  try {
    persona = (await request.json()).persona;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof persona !== "string" || !isDemoPersona(persona)) {
    return NextResponse.json({ error: "Invalid demo persona" }, { status: 400 });
  }

  const target = DEMO_PERSONAS.find((item) => item.id === persona)?.startPath || "/dashboard";
  const response = NextResponse.json({ ok: true, persona, target });
  response.cookies.set(DEMO_COOKIE_NAME, persona, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
