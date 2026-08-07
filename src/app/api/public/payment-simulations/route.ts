import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";
import {
  serializePaymentSimulation,
  startPaymentSimulation,
} from "@/server/integrations/payment-simulator";

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function POST(request: Request) {
  try {
    const body = await requestBody(request);
    const result = await startPaymentSimulation({
      ...body,
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
    });
    return successResponse(serializePaymentSimulation(result.simulation), {
      status: result.created ? 201 : 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
