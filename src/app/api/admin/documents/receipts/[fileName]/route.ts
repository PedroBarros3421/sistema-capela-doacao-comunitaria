import { requirePermission } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { readDonationReceiptFile } from "@/server/documents/donation-receipt";
import { NotFoundError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/responses";

export async function GET(request: Request, context: { params: Promise<{ fileName: string }> }) {
  try {
    await requirePermission(request, "RECEIPT_READ");
    const { fileName } = await context.params;
    if (!fileName.endsWith(".pdf")) throw new NotFoundError("Recibo não encontrado");
    const receiptId = fileName.slice(0, -4);
    const { bytes } = await readDonationReceiptFile(receiptId, { storagePath: getServerEnv().DOCUMENT_STORAGE_PATH });
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="recibo-${receiptId}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
