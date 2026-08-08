import { requirePermission } from "@/server/auth/session";
import { listLedgerEntries, type LedgerFilter } from "@/server/domains/finance/ledger-repository";
import { createManualLedgerEntry } from "@/server/domains/finance/manual-ledger-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new ValidationError("O corpo da solicitação deve conter JSON válido");
  }
}

export async function GET(request: Request) {
  try {
    const session = await requirePermission(request, "LEDGER_READ");
    void session;

    const url = new URL(request.url);
    const filter: LedgerFilter = {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
      type: (url.searchParams.get("type") as LedgerFilter["type"]) ?? undefined,
      status: (url.searchParams.get("status") as LedgerFilter["status"]) ?? undefined,
    };

    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

    const result = await listLedgerEntries(filter, { page, pageSize });
    return successResponse(result.items, {
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "LEDGER_WRITE");
    const body = await parseBody(request);
    const entry = await createManualLedgerEntry(session.user.id, body);
    return successResponse(entry, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
