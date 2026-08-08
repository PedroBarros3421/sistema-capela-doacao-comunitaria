import { getServerEnv } from "@/server/config/env";
import { readLatestAccountabilityReportFile } from "@/server/documents/accountability-report";
import { getLatestPublication } from "@/server/domains/reports/publication-service";
import { NotFoundError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/responses";

export async function GET() {
  try {
    const publication = await getLatestPublication();
    if (!publication?.generatedPdfPath) throw new NotFoundError("Nenhum PDF publicado está disponível");
    const bytes = await readLatestAccountabilityReportFile(
      publication.generatedPdfPath,
      getServerEnv().DOCUMENT_STORAGE_PATH,
    );
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="prestacao-de-contas-${publication.id}.pdf"`,
        "cache-control": "public, max-age=300",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
