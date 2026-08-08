import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { generateOpaqueToken, verifyPassword } from "@/server/auth/crypto";
import {
  blockUser,
  findUserByEmail,
  incrementFailedLoginCount,
  resetFailedLoginCount,
} from "@/server/domains/users/user-repository";
import {
  createSession,
  recordLoginAttempt,
} from "@/server/auth/auth-repository";
import { AuthenticationError, AuthorizationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const MAX_FAILURES = 5;
const SESSION_TTL_HOURS_DEFAULT = 8;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type LoginInput = z.infer<typeof loginSchema>;

type LoginDeps = {
  client: PrismaClient;
  env: {
    SESSION_COOKIE_NAME?: string;
    SESSION_TTL_HOURS?: number;
    APP_URL?: string;
  };
  context?: { ip?: string; userAgent?: string };
};

export async function login(rawInput: unknown, { client, env, context = {} }: LoginDeps) {
  const input: LoginInput = loginSchema.parse(rawInput);
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await findUserByEmail(normalizedEmail, client);

  if (!user) {
    await recordLoginAttempt(
      { attemptedEmail: normalizedEmail, result: "INVALID_CREDENTIALS", ...context },
      client,
    );
    throw new AuthenticationError("Credenciais inválidas");
  }

  if (user.status === "BLOCKED") {
    await recordLoginAttempt(
      { userId: user.id, attemptedEmail: normalizedEmail, result: "BLOCKED", ...context },
      client,
    );
    throw new AuthorizationError("Conta bloqueada. Entre em contato com o administrador.");
  }

  if (user.status === "PENDING") {
    await recordLoginAttempt(
      { userId: user.id, attemptedEmail: normalizedEmail, result: "PENDING", ...context },
      client,
    );
    throw new AuthorizationError("Conta pendente de ativação. Use o link de convite recebido.");
  }

  if (user.status === "INACTIVE") {
    await recordLoginAttempt(
      { userId: user.id, attemptedEmail: normalizedEmail, result: "INACTIVE", ...context },
      client,
    );
    throw new AuthorizationError("Conta inativa. Entre em contato com o administrador.");
  }

  const passwordOk = user.passwordHash
    ? await verifyPassword(user.passwordHash, input.password)
    : false;

  if (!passwordOk) {
    const updated = await incrementFailedLoginCount(user.id, client);

    if (updated.failedLoginCount >= MAX_FAILURES) {
      await blockUser(user.id, client);
      await recordLoginAttempt(
        { userId: user.id, attemptedEmail: normalizedEmail, result: "BLOCKED", ...context },
        client,
      );
      await appendAuditEvent(
        { actorKind: "PUBLIC", action: "user.blocked_on_login", entityType: "user", entityId: user.id, outcome: "FAILED" },
        client,
      );
      throw new AuthorizationError("Conta bloqueada após múltiplas tentativas inválidas.");
    }

    await recordLoginAttempt(
      { userId: user.id, attemptedEmail: normalizedEmail, result: "INVALID_CREDENTIALS", ...context },
      client,
    );
    throw new AuthenticationError("Credenciais inválidas");
  }

  const ttlHours = env.SESSION_TTL_HOURS ?? SESSION_TTL_HOURS_DEFAULT;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const token = generateOpaqueToken();

  await resetFailedLoginCount(user.id, client);
  await createSession(user.id, token, expiresAt, context, client);

  await recordLoginAttempt(
    { userId: user.id, attemptedEmail: normalizedEmail, result: "SUCCESS", ...context },
    client,
  );

  await appendAuditEvent(
    {
      actorKind: "USER",
      actorUserId: user.id,
      action: "user.login",
      entityType: "user",
      entityId: user.id,
      outcome: "SUCCESS",
    },
    client,
  );

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      failedLoginCount: 0,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  };
}
