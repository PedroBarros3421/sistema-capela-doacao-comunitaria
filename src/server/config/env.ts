import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  APP_URL: z.string().url(),
  SESSION_COOKIE_NAME: nonEmpty.regex(/^[A-Za-z0-9_-]+$/).default("capela_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24).default(8),
  DOCUMENT_STORAGE_PATH: nonEmpty.default("./storage"),
  CHAPEL_NAME: nonEmpty,
  CHAPEL_CONTACT_EMAIL: z.email(),
  CHAPEL_CONTACT_PHONE: nonEmpty,
  SEED_ADMIN_NAME: nonEmpty.default("Administrador da Capela"),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string().min(8).regex(/(?=.*[A-Za-z])(?=.*\d)/),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  if (source === process.env && cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const variables = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(`Invalid server environment variables: ${variables}`);
  }

  if (source === process.env) {
    cachedEnv = parsed.data;
  }

  return parsed.data;
}

export function resetServerEnvForTests(): void {
  cachedEnv = undefined;
}
