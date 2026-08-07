import { describe, expect, it, vi } from "vitest";

import { createLogger, redactSensitive } from "@/server/observability/logger";

describe("structured logger", () => {
  it("emits one JSON object with UTC time and context", () => {
    const sink = vi.fn();
    const logger = createLogger(sink);

    logger.info("session.created", { userId: "user-1" });

    const entry = JSON.parse(sink.mock.calls[0][0]);
    expect(entry.level).toBe("info");
    expect(entry.event).toBe("session.created");
    expect(entry.timestamp).toMatch(/Z$/);
    expect(entry.context.userId).toBe("user-1");
  });

  it("recursively redacts secrets and personal data", () => {
    const result = redactSensitive({
      password: "secret",
      nested: { sessionToken: "raw-token", email: "person@example.org", safe: "ok" },
    });

    expect(result).toEqual({
      password: "[REDACTED]",
      nested: { sessionToken: "[REDACTED]", email: "[REDACTED]", safe: "ok" },
    });
  });
});
