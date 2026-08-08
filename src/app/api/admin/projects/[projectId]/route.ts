import { requirePermission } from "@/server/auth/session";
import { updateProject } from "@/server/domains/projects/project-admin-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const session = await requirePermission(request, "PROJECT_MANAGE");
    const { projectId } = await context.params;
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new ValidationError("O corpo deve conter JSON válido");
    }
    const project = await updateProject(session.user.id, projectId, input);
    return successResponse(project);
  } catch (error) {
    return errorResponse(error);
  }
}
