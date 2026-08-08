import { requirePermission } from "@/server/auth/session";
import { listDonorMatchReviews } from "@/server/domains/donors/review-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "DONOR_READ");

    const url = new URL(request.url);
    const result = await listDonorMatchReviews(
      (url.searchParams.get("status") as "OPEN" | "KEEP_SEPARATE" | "MERGED") ?? undefined,
      { page: Number(url.searchParams.get("page") ?? "1") },
    );

    return successResponse(result.items, {
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
