import { z } from "zod";
import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/http/errors";
import { errorResponse, successResponse } from "@/server/http/responses";

describe("HTTP response envelopes", () => {
  it("wraps successful data and metadata", async () => {
    const response = successResponse([{ id: "1" }], { meta: { page: 1 } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "1" }], meta: { page: 1 } });
  });

  it("preserves safe application errors", async () => {
    const response = errorResponse(new AuthorizationError(), "request-1");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Você não tem permissão para esta ação",
        requestId: "request-1",
      },
    });
  });

  it("maps Zod issues to field errors", async () => {
    const result = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    if (result.success) throw new Error("Expected validation to fail");

    const response = errorResponse(result.error);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors.name).toHaveLength(1);
  });

  it("does not expose unknown exception messages", async () => {
    const response = errorResponse(new Error("database password leaked"));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("database password leaked");
  });
});
