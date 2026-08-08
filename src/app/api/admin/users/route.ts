import type { UserRole, UserStatus } from "@prisma/client";

import { requirePermission } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { createUser, listUsers } from "@/server/domains/users/user-admin-service";
import { ValidationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "USER_MANAGE");
    const url = new URL(request.url);
    const result = await listUsers({
      status: (url.searchParams.get("status") as UserStatus) ?? undefined,
      role: (url.searchParams.get("role") as UserRole) ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
    });
    return successResponse(result.items, {
      meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, "USER_MANAGE");
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new ValidationError("O corpo deve conter JSON válido");
    }
    const result = await createUser(session.user.id, input, getServerEnv().APP_URL);
    return successResponse(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
