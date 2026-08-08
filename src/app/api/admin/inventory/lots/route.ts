import { requirePermission } from "@/server/auth/session";
import { createInventoryLot, listConsolidatedInventory } from "@/server/domains/inventory/inventory-repository";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function body(request: Request) {
  try { return await request.json() as unknown; } catch { throw new ValidationError("O corpo deve conter JSON válido"); }
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "INVENTORY_READ");
    const url = new URL(request.url);
    const window = url.searchParams.get("expiryWindowDays");
    const result = await listConsolidatedInventory({
      itemId: url.searchParams.get("itemId") ?? undefined,
      expiryWindowDays: window === "7" || window === "30" ? Number(window) as 7 | 30 : undefined,
      includeLots: url.searchParams.get("includeLots") === "true",
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
    });
    return successResponse(result.items, { meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "INVENTORY_WRITE");
    return successResponse(await createInventoryLot(session.user.id, await body(request)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
