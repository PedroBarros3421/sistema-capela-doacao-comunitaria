import { setPasswordFromInvitation } from "@/server/auth/password-links";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, noContentResponse } from "@/server/http/responses";

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function PUT(request: Request) {
  try {
    const token = extractBearerToken(request);
    if (!token) throw new ValidationError("Token de acesso ausente");
    const body = await requestBody(request);
    await setPasswordFromInvitation(token, body);
    return noContentResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
