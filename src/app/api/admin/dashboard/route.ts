import { requirePermission } from "@/server/auth/session";
import { getDashboard } from "@/server/domains/finance/dashboard-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "DASHBOARD_READ");
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? undefined;
    const dashboard = await getDashboard(month);
    return successResponse(dashboard);
  } catch (error) {
    return errorResponse(error);
  }
}
