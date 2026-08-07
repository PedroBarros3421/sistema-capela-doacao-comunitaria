import { describe, expect, it } from "vitest";

import {
  generateOpaqueToken,
  hashPassword,
  hashSecret,
  secretMatchesHash,
  verifyPassword,
} from "@/server/auth/crypto";

describe("authentication cryptography", () => {
  it("stores passwords as Argon2id hashes", async () => {
    const password = "uma-senha-de-teste-segura";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, "senha-incorreta")).resolves.toBe(false);
  });

  it("creates independent URL-safe opaque tokens", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("hashes secrets with SHA-256 and compares them safely", () => {
    const digest = hashSecret("segredo");

    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(secretMatchesHash("segredo", digest)).toBe(true);
    expect(secretMatchesHash("outro", digest)).toBe(false);
    expect(secretMatchesHash("segredo", "invalid")).toBe(false);
  });
});
