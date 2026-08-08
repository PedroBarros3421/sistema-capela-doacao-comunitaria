import { getServerEnv } from "@/server/config/env";
import { requestDonorAccountAccess } from "@/server/domains/donors/account-access-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function POST(request: Request) {
  try {
    const result = await requestDonorAccountAccess(await requestBody(request), getServerEnv().APP_URL);
    return successResponse(result, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
