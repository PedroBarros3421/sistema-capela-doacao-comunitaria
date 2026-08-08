import { login } from "@/server/auth/login-service";
import { sessionCookieOptions } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { ValidationError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/responses";

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

function cookieHeader(options: ReturnType<typeof sessionCookieOptions>, value: string): string {
  const parts = [
    `${options.name}=${value}`,
    `Path=${options.path}`,
    `Expires=${options.expires.toUTCString()}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const body = await requestBody(request);
    const ip = request.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const result = await login(body, { client: db, env, context: { ip, userAgent } });
    const options = sessionCookieOptions(result.expiresAt);

    return new Response(null, {
      status: 204,
      headers: { "set-cookie": cookieHeader(options, result.token) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
