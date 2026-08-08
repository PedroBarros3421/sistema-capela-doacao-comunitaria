import { requirePermission } from "@/server/auth/session";
import { buildReportSnapshot } from "@/server/domains/reports/report-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "REPORT_READ");
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const category = url.searchParams.get("category") ?? undefined;
    const snapshot = await buildReportSnapshot({ from, to, category });
    return successResponse(snapshot);
  } catch (error) {
    return errorResponse(error);
  }
}
