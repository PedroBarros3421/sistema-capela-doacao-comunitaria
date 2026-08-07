import { getPublicConfiguration } from "@/server/config/public-config";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET() {
  try {
    return successResponse(await getPublicConfiguration());
  } catch (error) {
    return errorResponse(error);
  }
}
