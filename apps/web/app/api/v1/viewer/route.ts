import { AuthenticationRequiredError, PrincipalRequestError } from "@/lib/internal-api/principal-client";
import { getPrincipalClient } from "@/lib/internal-api/principal-runtime";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  try {
    const viewer = await (await getPrincipalClient()).viewer(request.headers);
    return Response.json({ viewer }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "authentication_required" }, { status: 401, headers: privateHeaders });
    }
    if (error instanceof PrincipalRequestError && error.status === 404) {
      return Response.json({ error: "enrollment_required" }, { status: 404, headers: privateHeaders });
    }
    if (error instanceof PrincipalRequestError && error.status === 403) {
      return Response.json({ error: "account_unavailable" }, { status: 403, headers: privateHeaders });
    }
    return Response.json({ error: "viewer_unavailable" }, { status: 502, headers: privateHeaders });
  }
}
