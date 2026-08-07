import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuthenticatedRequest } from "../helpers/auth";
import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createProject, createUser } from "../helpers/factories";

describe("disposable database helpers", () => {
  let database: DisposableDatabase | undefined;

  beforeAll(async () => {
    database = await createDisposableDatabase();
  });

  afterAll(async () => {
    await database?.cleanup();
  });

  it("creates isolated model fixtures and an authenticated request", async () => {
    if (!database) throw new Error("Disposable database was not initialized");
    const user = await createUser(database.client, { role: "FINANCE" });
    const project = await createProject(database.client);
    const authenticated = await createAuthenticatedRequest(database.client, user.id);

    expect(user.email).toMatch(/@example\.org$/);
    expect(project.status).toBe("ACTIVE");
    expect(authenticated.request.headers.get("cookie")).toContain(authenticated.token);
    expect(await database.client.session.count()).toBe(1);
  });
});
