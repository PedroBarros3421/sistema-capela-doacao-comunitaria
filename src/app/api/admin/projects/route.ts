import type { ProjectStatus } from "@prisma/client";

import { requirePermission } from "@/server/auth/session";
import { createProject, listProjects } from "@/server/domains/projects/project-admin-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "ADMIN_ACCESS");
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") as ProjectStatus) ?? undefined;
    return successResponse(await listProjects(status));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "PROJECT_MANAGE");
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new ValidationError("O corpo deve conter JSON válido");
    }
    const project = await createProject(session.user.id, input);
    return successResponse(project, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
