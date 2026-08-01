import { readSessionRevocationRequest } from "@/lib/auth-v2/browser-request";
import { getAuth } from "@/lib/auth-v2/server";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = getAuth();
    const current = await auth.api.getSession({ headers: request.headers });
    if (!current) return Response.json({ error: "authentication_required" }, { status: 401, headers: privateHeaders });
    const sessions = await auth.api.listSessions({ headers: request.headers });
    return Response.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        current: session.id === current.session.id,
      })),
    }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: "session_list_unavailable" }, { status: 401, headers: privateHeaders });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const input = await readSessionRevocationRequest(request, process.env.BETTER_AUTH_URL ?? "");
    const auth = getAuth();
    const current = await auth.api.getSession({ headers: request.headers });
    if (!current) return Response.json({ error: "authentication_required" }, { status: 401, headers: privateHeaders });

    if (input.scope === "ONE") {
      const sessions = await auth.api.listSessions({ headers: request.headers });
      const target = sessions.find((session) => session.id === input.sessionId);
      if (!target) return Response.json({ error: "session_not_found" }, { status: 404, headers: privateHeaders });
      await auth.api.revokeSession({ headers: request.headers, body: { token: target.token } });
      return Response.json({ revokedCurrent: target.id === current.session.id }, { headers: privateHeaders });
    }
    if (input.scope === "OTHERS") {
      await auth.api.revokeOtherSessions({ headers: request.headers });
      return Response.json({ revokedCurrent: false }, { headers: privateHeaders });
    }
    await auth.api.revokeSessions({ headers: request.headers });
    return Response.json({ revokedCurrent: true }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: "invalid_session_request" }, { status: 400, headers: privateHeaders });
  }
}