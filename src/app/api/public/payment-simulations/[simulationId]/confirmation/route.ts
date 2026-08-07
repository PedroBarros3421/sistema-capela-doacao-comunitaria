import { z } from "zod";

import { getServerEnv } from "@/server/config/env";
import { confirmDonation } from "@/server/domains/finance/confirm-donation";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

type ConfirmationRouteContext = {
  params: Promise<{ simulationId: string }>;
};

export async function POST(request: Request, context: ConfirmationRouteContext) {
  try {
    const { simulationId } = await context.params;
    const body = await request.json().catch(() => {
      throw new ValidationError("O corpo da solicitação deve conter JSON válido");
    }) as Record<string, unknown>;
    const env = getServerEnv();
    const result = await confirmDonation({
      simulationId: z.uuid().parse(simulationId),
      confirmationKey: request.headers.get("idempotency-key") ?? undefined,
      outcome: body.outcome,
    }, {
      appUrl: env.APP_URL,
      storagePath: env.DOCUMENT_STORAGE_PATH,
    });
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
