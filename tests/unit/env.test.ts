import { describe, expect, it } from "vitest";

import { getServerEnv } from "@/server/config/env";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@localhost:5432/capela",
  APP_URL: "http://localhost:3000",
  CHAPEL_NAME: "Capela Comunitaria",
  CHAPEL_CONTACT_EMAIL: "contato@example.org",
  CHAPEL_CONTACT_PHONE: "5585999999999",
  SEED_ADMIN_EMAIL: "admin@example.org",
  SEED_ADMIN_PASSWORD: "a-secure-test-password",
};

describe("getServerEnv", () => {
  it("normalizes defaults and numeric values", () => {
    const env = getServerEnv(validEnv);

    expect(env.SESSION_COOKIE_NAME).toBe("capela_session");
    expect(env.SESSION_TTL_HOURS).toBe(8);
    expect(env.DOCUMENT_STORAGE_PATH).toBe("./storage");
  });

  it("reports invalid variable names without exposing their values", () => {
    expect(() =>
      getServerEnv({ ...validEnv, DATABASE_URL: "not-a-database-url" }),
    ).toThrow("Invalid server environment variables: DATABASE_URL");
  });
});
