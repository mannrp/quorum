import { getAuth } from "@/lib/auth-v2/server";

function authHandler(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export const GET = authHandler;
export const POST = authHandler;
export const PUT = authHandler;
export const DELETE = authHandler;
export const PATCH = authHandler;
