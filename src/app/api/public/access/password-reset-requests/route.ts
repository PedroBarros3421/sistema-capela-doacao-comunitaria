import { requestPasswordReset } from "@/server/auth/password-links";
import { getServerEnv } from "@/server/config/env";
import { ValidationError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/responses";

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function POST(request: Request) {
  try {
    const body = await requestBody(request);
    const env = getServerEnv();
    const result = await requestPasswordReset(body, env.APP_URL);
    return Response.json(result, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
