import { requirePermission } from "@/server/auth/session";
import { getDonorDetail } from "@/server/domains/donors/donor-query-service";
import { NotFoundError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request, { params }: { params: Promise<{ donorId: string }> }) {
  try {
    await requirePermission(request, "DONOR_READ");
    const { donorId } = await params;
    const detail = await getDonorDetail(donorId);
    if (!detail) throw new NotFoundError("Doador não encontrado");
    return successResponse(detail);
  } catch (error) {
    return errorResponse(error);
  }
}
