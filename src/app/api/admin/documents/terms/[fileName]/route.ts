import { requirePermission } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { readInKindTermFile } from "@/server/documents/in-kind-term";
import { NotFoundError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/responses";

export async function GET(request: Request, context: { params: Promise<{ fileName: string }> }) {
  try {
    await requirePermission(request, "IN_KIND_TERM_READ");
    const { fileName } = await context.params;
    if (!fileName.endsWith(".pdf")) throw new NotFoundError("Termo não encontrado");
    const termId = fileName.slice(0, -4);
    const { bytes } = await readInKindTermFile(termId, { storagePath: getServerEnv().DOCUMENT_STORAGE_PATH });
    return new Response(bytes as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="termo-${termId}.pdf"`, "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
