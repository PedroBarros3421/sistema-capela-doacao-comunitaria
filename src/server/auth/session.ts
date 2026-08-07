import type { UserRole } from "@prisma/client";

import { hashSecret } from "@/server/auth/crypto";
import { assertPermission, type Permission } from "@/server/auth/permissions";
import { getServerEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { AuthenticationError } from "@/server/http/errors";

export type AuthenticatedSession = {
  id: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
};

function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([cookieName]) => cookieName === name)
    ?.slice(1)
    .join("=");
}

export async function loadSession(request: Request): Promise<AuthenticatedSession | null> {
  const env = getServerEnv();
  const token = readCookie(request.headers.get("cookie"), env.SESSION_COOKIE_NAME);
  if (!token) return null;

  const now = new Date();
  const session = await db.session.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      user: { select: { id: true, name: true, email: true, role: true, status: true } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== "ACTIVE") {
    return null;
  }

  if (now.valueOf() - session.lastSeenAt.valueOf() >= 5 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }

  return {
    id: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
  };
}

export async function requireSession(request: Request): Promise<AuthenticatedSession> {
  const session = await loadSession(request);
  if (!session) throw new AuthenticationError();
  return session;
}

export async function requirePermission(
  request: Request,
  permission: Permission,
): Promise<AuthenticatedSession> {
  const session = await requireSession(request);
  assertPermission(session.user.role, permission);
  return session;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: getServerEnv().SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
