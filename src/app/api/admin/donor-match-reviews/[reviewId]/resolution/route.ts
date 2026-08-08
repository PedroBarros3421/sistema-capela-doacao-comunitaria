import { requirePermission } from "@/server/auth/session";
import { resolveDonorMatchReview } from "@/server/domains/donors/review-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("O corpo deve conter JSON válido");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const session = await requirePermission(request, "DONOR_WRITE");
    const { reviewId } = await params;
    const resolved = await resolveDonorMatchReview(session.user.id, reviewId, await body(request));
    return successResponse(resolved);
  } catch (error) {
    return errorResponse(error);
  }
}
