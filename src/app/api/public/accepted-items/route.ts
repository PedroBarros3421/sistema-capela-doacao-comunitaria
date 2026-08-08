import { listPublicAcceptedItems } from "@/server/domains/inventory/accepted-items-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET() {
  try {
    return successResponse(await listPublicAcceptedItems());
  } catch (error) {
    return errorResponse(error);
  }
}
