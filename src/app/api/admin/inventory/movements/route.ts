import { requirePermission } from "@/server/auth/session";
import { discardInventory } from "@/server/domains/inventory/discard-service";
import { distributeInventory } from "@/server/domains/inventory/distribution-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "INVENTORY_WRITE");
    let input: unknown;
    try { input = await request.json(); } catch { throw new ValidationError("O corpo deve conter JSON válido"); }
    if (!input || typeof input !== "object" || !("type" in input)) throw new ValidationError("Informe o tipo da movimentação");
    const movement = input.type === "DISTRIBUTION"
      ? await distributeInventory(session.user.id, input)
      : input.type === "DISCARD"
        ? await discardInventory(session.user.id, input)
        : (() => { throw new ValidationError("Tipo de movimentação inválido"); })();
    return successResponse(movement, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
