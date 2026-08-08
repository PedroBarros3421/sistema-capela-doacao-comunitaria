import { requirePermission } from "@/server/auth/session";
import { updateUser } from "@/server/domains/users/user-admin-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requirePermission(request, "USER_MANAGE");
    const { userId } = await context.params;
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new ValidationError("O corpo deve conter JSON válido");
    }
    const user = await updateUser(session.user.id, userId, input);
    return successResponse(user);
  } catch (error) {
    return errorResponse(error);
  }
}
