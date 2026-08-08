import { requirePermission } from "@/server/auth/session";
import { listDonors } from "@/server/domains/donors/donor-query-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "DONOR_READ");

    const url = new URL(request.url);
    const result = await listDonors(
      {
        query: url.searchParams.get("query") ?? undefined,
        relationshipType: (url.searchParams.get("relationshipType") as "ONE_OFF" | "RECURRING" | "IN_KIND") ?? undefined,
        reviewStatus: (url.searchParams.get("reviewStatus") as "CLEAR" | "PENDING_REVIEW") ?? undefined,
      },
      { page: Number(url.searchParams.get("page") ?? "1") },
    );

    return successResponse(result.items, {
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
