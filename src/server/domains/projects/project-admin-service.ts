import type { PrismaClient, ProjectStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const createProjectSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
const updateProjectSchema = z
  .object({ name: z.string().trim().min(1).max(120).optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() })
  .strict();

function serializeProject(project: { id: string; name: string; status: ProjectStatus; createdAt: Date }) {
  return { id: project.id, name: project.name, status: project.status, createdAt: project.createdAt.toISOString() };
}

export async function listProjects(status: ProjectStatus | undefined, client: PrismaClient = db) {
  const projects = await client.project.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ name: "asc" }],
  });
  return projects.map(serializeProject);
}

export async function createProject(actorUserId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = createProjectSchema.parse(rawInput);
  return client.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { name: input.name } });
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "project.create",
      entityType: "Project", entityId: project.id, outcome: "SUCCESS",
      metadata: {}, allowedMetadataKeys: [],
    }, tx);
    return serializeProject(project);
  });
}

export async function updateProject(actorUserId: string, projectId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = updateProjectSchema.parse(rawInput);
  if (Object.keys(input).length === 0) throw new ValidationError("Informe ao menos um campo para atualizar");
  return client.$transaction(async (tx) => {
    const existing = await tx.project.findUnique({ where: { id: projectId } });
    if (!existing) throw new NotFoundError("Projeto não encontrado");
    const project = await tx.project.update({ where: { id: projectId }, data: input });
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "project.update",
      entityType: "Project", entityId: projectId, outcome: "SUCCESS",
      metadata: {}, allowedMetadataKeys: [],
    }, tx);
    return serializeProject(project);
  });
}
