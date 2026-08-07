import { z } from "zod";

import { errorResponse, successResponse } from "@/server/http/responses";
import {
  getPaymentSimulation,
  serializePaymentSimulation,
} from "@/server/integrations/payment-simulator";

type SimulationRouteContext = {
  params: Promise<{ simulationId: string }>;
};

export async function GET(_request: Request, context: SimulationRouteContext) {
  try {
    const { simulationId } = await context.params;
    const id = z.uuid().parse(simulationId);
    return successResponse(serializePaymentSimulation(await getPaymentSimulation(id)));
  } catch (error) {
    return errorResponse(error);
  }
}
