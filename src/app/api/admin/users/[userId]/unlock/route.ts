import { requirePermission } from "@/server/auth/session";
import { unlockUser } from "@/server/domains/users/user-admin-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requirePermission(request, "USER_MANAGE");
    const { userId } = await context.params;
    const user = await unlockUser(session.user.id, userId);
    return successResponse(user);
  } catch (error) {
    return errorResponse(error);
  }
}
