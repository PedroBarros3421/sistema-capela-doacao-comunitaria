import { requireDonorAccess } from "@/server/auth/access-links";
import { updateOwnedSubscription } from "@/server/domains/donors/subscription-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ subscriptionId: string }> }) {
  try {
    const { donorId } = await requireDonorAccess(request);
    const { subscriptionId } = await params;
    const subscription = await updateOwnedSubscription(donorId, subscriptionId, await requestBody(request));
    return successResponse(subscription);
  } catch (error) {
    return errorResponse(error);
  }
}
