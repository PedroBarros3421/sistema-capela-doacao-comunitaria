import { updateProfile } from "@/server/auth/account-service";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { serializeUser } from "@/server/domains/users/user-repository";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
    return successResponse(serializeUser(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession(request);
    const body = await requestBody(request);
    const user = await updateProfile(session.user.id, body);
    return successResponse(serializeUser(user));
  } catch (error) {
    return errorResponse(error);
  }
}
