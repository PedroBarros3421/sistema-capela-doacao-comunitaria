import { logout } from "@/server/auth/account-service";
import { requireSession, sessionCookieOptions } from "@/server/auth/session";
import { errorResponse } from "@/server/http/responses";

function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    await logout(session.id);
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": clearCookieHeader(sessionCookieOptions(new Date()).name) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
