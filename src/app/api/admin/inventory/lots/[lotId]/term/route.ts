import { requirePermission } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { generateInKindTerm } from "@/server/documents/in-kind-term";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function POST(request: Request, context: { params: Promise<{ lotId: string }> }) {
  try {
    await requirePermission(request, "IN_KIND_TERM_READ");
    const { lotId } = await context.params;
    return successResponse(await generateInKindTerm(lotId, { storagePath: getServerEnv().DOCUMENT_STORAGE_PATH }), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
