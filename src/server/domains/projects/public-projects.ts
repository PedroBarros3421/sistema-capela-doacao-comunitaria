import type { PrismaClient } from "@prisma/client";

import { db } from "@/server/db/client";

type ProjectReader = Pick<PrismaClient, "project">;

export async function listActiveProjects(client: ProjectReader = db) {
  return client.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
}
