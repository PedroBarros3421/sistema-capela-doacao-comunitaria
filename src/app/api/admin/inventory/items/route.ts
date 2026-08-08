import { requirePermission } from "@/server/auth/session";
import { createInventoryItem, listInventoryItems } from "@/server/domains/inventory/inventory-repository";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function body(request: Request) {
  try { return await request.json() as unknown; } catch { throw new ValidationError("O corpo deve conter JSON válido"); }
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "INVENTORY_READ");
    return successResponse(await listInventoryItems());
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "INVENTORY_WRITE");
    return successResponse(await createInventoryItem(session.user.id, await body(request)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
