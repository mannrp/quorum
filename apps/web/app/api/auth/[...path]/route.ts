import { getAuth } from "@/lib/auth/server";

type AuthRouteContext = {
  params: Promise<{ path: string[] }>;
};

function authHandler(method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH") {
  return (request: Request, context: AuthRouteContext) => getAuth().handler()[method](request, context);
}

export const GET = authHandler("GET");
export const POST = authHandler("POST");
export const PUT = authHandler("PUT");
export const DELETE = authHandler("DELETE");
export const PATCH = authHandler("PATCH");
