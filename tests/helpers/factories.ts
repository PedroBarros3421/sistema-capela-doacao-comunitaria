import type { PrismaClient, ProjectStatus, UserRole, UserStatus } from "@prisma/client";

import { hashPassword } from "../../src/server/auth/crypto";

let sequence = 0;

export async function createUser(
  client: PrismaClient,
  overrides: Partial<{
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    password: string;
  }> = {},
) {
  sequence += 1;
  const password = overrides.password ?? "secure-test-password-1";
  return client.user.create({
    data: {
      name: overrides.name ?? `Usuário ${sequence}`,
      email: overrides.email ?? `user-${sequence}@example.org`,
      role: overrides.role ?? "GENERAL_ADMIN",
      status: overrides.status ?? "ACTIVE",
      passwordHash: await hashPassword(password),
    },
  });
}

export async function createProject(
  client: PrismaClient,
  overrides: Partial<{ name: string; status: ProjectStatus }> = {},
) {
  sequence += 1;
  return client.project.create({
    data: {
      name: overrides.name ?? `Projeto ${sequence}`,
      status: overrides.status ?? "ACTIVE",
    },
  });
}
