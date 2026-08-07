import { describe, expect, it } from "vitest";

import { hasTrustedOrigin } from "@/server/auth/csrf";

const appUrl = "https://capela.example.org";

describe("CSRF origin validation", () => {
  it("allows safe methods without an Origin header", () => {
    expect(hasTrustedOrigin(new Request(`${appUrl}/api/admin/me`), appUrl)).toBe(true);
  });

  it("accepts unsafe requests only from the configured origin", () => {
    const sameOrigin = new Request(`${appUrl}/api/admin/me`, {
      method: "POST",
      headers: { origin: appUrl },
    });
    const crossOrigin = new Request(`${appUrl}/api/admin/me`, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(hasTrustedOrigin(sameOrigin, appUrl)).toBe(true);
    expect(hasTrustedOrigin(crossOrigin, appUrl)).toBe(false);
  });

  it("rejects unsafe requests without Origin", () => {
    const request = new Request(`${appUrl}/api/admin/me`, { method: "DELETE" });
    expect(hasTrustedOrigin(request, appUrl)).toBe(false);
  });
});
