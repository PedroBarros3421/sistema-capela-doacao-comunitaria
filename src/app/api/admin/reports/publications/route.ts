import { requirePermission } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { listPublications, publishReport } from "@/server/domains/reports/publication-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "REPORT_READ");
    return successResponse(await listPublications());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "REPORT_PUBLISH");
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new ValidationError("O corpo deve conter JSON válido");
    }
    const publication = await publishReport(session.user.id, input, {
      storagePath: getServerEnv().DOCUMENT_STORAGE_PATH,
    });
    return successResponse(publication, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
