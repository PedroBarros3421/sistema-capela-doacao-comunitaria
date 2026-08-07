import type { PrismaClient } from "@prisma/client";

import { getServerEnv, type ServerEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { listActiveProjects } from "@/server/domains/projects/public-projects";

export async function getPublicConfiguration(
  client: Pick<PrismaClient, "project"> = db,
  env: ServerEnv = getServerEnv(),
) {
  return {
    projects: await listActiveProjects(client),
    volunteerHelp: {
      label: "Chamar um voluntário" as const,
      contact: env.CHAPEL_CONTACT_PHONE,
    },
    itemDelivery: {
      address: env.CHAPEL_NAME,
      instructions: `Entre em contato pelo telefone ${env.CHAPEL_CONTACT_PHONE} ou pelo e-mail ${env.CHAPEL_CONTACT_EMAIL} antes da entrega.`,
    },
  };
}
