import { requirePermission } from "@/server/auth/session";
import { listLoginAttempts } from "@/server/domains/users/login-history-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "LOGIN_ATTEMPT_READ");
    const url = new URL(request.url);
    const result = await listLoginAttempts({
      userId: url.searchParams.get("userId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
    });
    return successResponse(result.items, {
      meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
