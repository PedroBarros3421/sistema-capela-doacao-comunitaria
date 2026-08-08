import { requireDonorAccess } from "@/server/auth/access-links";
import { getServerEnv } from "@/server/config/env";
import { readDonationReceiptFile } from "@/server/documents/donation-receipt";
import { NotFoundError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/responses";

export async function GET(request: Request, { params }: { params: Promise<{ receiptId: string }> }) {
  try {
    const { donorId } = await requireDonorAccess(request);
    const { receiptId } = await params;
    const { receipt, bytes } = await readDonationReceiptFile(receiptId, {
      storagePath: getServerEnv().DOCUMENT_STORAGE_PATH,
    });
    if (receipt.donorId !== donorId) throw new NotFoundError("Recibo não encontrado");
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="recibo-${receipt.id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
