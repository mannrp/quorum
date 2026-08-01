import { readEnrollmentRequest } from "@/lib/auth-v2/browser-request";
import { AuthenticationRequiredError, PrincipalRequestError } from "@/lib/internal-api/principal-client";
import { getPrincipalClient } from "@/lib/internal-api/principal-runtime";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request): Promise<Response> {
  try {
    const role = await readEnrollmentRequest(request, process.env.BETTER_AUTH_URL ?? "");
    const viewer = await (await getPrincipalClient()).enroll(request.headers, role);
    return Response.json({ viewer }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "authentication_required" }, { status: 401, headers: privateHeaders });
    }
    if (error instanceof PrincipalRequestError) {
      const status = error.status === 409 ? 409 : error.status === 403 ? 403 : 502;
      return Response.json({ error: "enrollment_failed" }, { status, headers: privateHeaders });
    }
    return Response.json({ error: "invalid_enrollment_request" }, { status: 400, headers: privateHeaders });
  }
}
