import { getLatestPublication } from "@/server/domains/reports/publication-service";
import { NotFoundError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";
import type { PublicReportSnapshot } from "@/server/domains/reports/publication-service";

export async function GET() {
  try {
    const publication = await getLatestPublication();
    if (!publication) throw new NotFoundError("Nenhuma prestação de contas foi publicada");
    const snapshot = publication.snapshot as PublicReportSnapshot;
    return successResponse({
      id: publication.id,
      publishedAt: publication.publishedAt.toISOString(),
      period: { from: snapshot.from, to: snapshot.to },
      totals: {
        moneyReceived: snapshot.totals.moneyRaised,
        inKindEstimated: snapshot.totals.inKindReceived,
        spent: snapshot.totals.moneySpent,
      },
      byProject: snapshot.byProject.map((project) => ({
        projectName: project.projectName,
        moneyReceived: project.moneyRaised,
        spent: project.moneySpent,
      })),
      inventory: snapshot.inventory,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
