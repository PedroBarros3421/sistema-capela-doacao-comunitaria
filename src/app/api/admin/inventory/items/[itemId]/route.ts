import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { updateItemAcceptance } from "@/server/domains/inventory/accepted-items-service";
import { getInventoryItem, updateInventoryCatalog } from "@/server/domains/inventory/inventory-repository";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function body(request: Request) {
  try { return await request.json() as unknown; } catch { throw new ValidationError("O corpo deve conter JSON válido"); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const session = await requirePermission(request, "ACCEPTED_ITEM_WRITE");
    const { itemId } = await params;
    const input = await body(request);
    const item = await db.$transaction(async (tx) => {
      await updateInventoryCatalog(itemId, input, tx);
      await updateItemAcceptance(session.user.id, itemId, input, tx);
      return getInventoryItem(itemId, tx);
    });
    return successResponse(item);
  } catch (error) { return errorResponse(error); }
}
