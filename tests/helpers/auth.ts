import type { PrismaClient } from "@prisma/client";

import { generateOpaqueToken, hashSecret } from "../../src/server/auth/crypto";

export async function createAuthenticatedRequest(
  client: PrismaClient,
  userId: string,
  options: { method?: string; url?: string; origin?: string; cookieName?: string } = {},
) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const session = await client.session.create({
    data: { userId, tokenHash: hashSecret(token), expiresAt },
  });
  const url = options.url ?? "http://localhost:3000/api/admin/test";

  return {
    session,
    token,
    request: new Request(url, {
      method: options.method ?? "GET",
      headers: {
        cookie: `${options.cookieName ?? "capela_session"}=${token}`,
        origin: options.origin ?? new URL(url).origin,
      },
    }),
  };
}
