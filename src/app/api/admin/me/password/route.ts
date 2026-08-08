import { changePassword } from "@/server/auth/account-service";
import { requireSession } from "@/server/auth/session";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, noContentResponse } from "@/server/http/responses";

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession(request);
    const body = await requestBody(request);
    await changePassword(session.user.id, session.id, body);
    return noContentResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
