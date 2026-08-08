import { requirePermission } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { resendInvitation } from "@/server/domains/users/invitation-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requirePermission(request, "USER_MANAGE");
    const { userId } = await context.params;
    const result = await resendInvitation(session.user.id, userId, getServerEnv().APP_URL);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
