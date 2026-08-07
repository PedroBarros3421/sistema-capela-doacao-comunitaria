import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

describe("administrative route boundary", () => {
  it("redirects anonymous administrative pages to login", () => {
    const response = proxy(new NextRequest("https://capela.example.org/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://capela.example.org/admin/login?returnTo=%2Fadmin",
    );
  });

  it("returns an HTTP envelope for anonymous administrative APIs", async () => {
    const response = proxy(new NextRequest("https://capela.example.org/api/admin/me"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" },
    });
  });

  it("rejects cross-origin mutations even when a cookie is present", async () => {
    const request = new NextRequest("https://capela.example.org/api/admin/me", {
      method: "POST",
      headers: {
        cookie: "capela_session=opaque-token",
        origin: "https://attacker.example",
      },
    });
    const response = proxy(request);

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("CSRF_ORIGIN_MISMATCH");
  });
});
