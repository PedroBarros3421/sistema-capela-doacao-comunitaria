import { requirePermission } from "@/server/auth/session";
import { suggestDistribution } from "@/server/domains/inventory/distribution-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function POST(request: Request) {
  try {
    await requirePermission(request, "INVENTORY_WRITE");
    let input: unknown;
    try { input = await request.json(); } catch { throw new ValidationError("O corpo deve conter JSON válido"); }
    return successResponse(await suggestDistribution(input));
  } catch (error) { return errorResponse(error); }
}
