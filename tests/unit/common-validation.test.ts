import { describe, expect, it } from "vitest";

import {
  calendarDateSchema,
  documentSchema,
  emailSchema,
  moneySchema,
  normalizeDecimal,
  phoneSchema,
  quantitySchema,
} from "@/server/validation/common";

describe("common validation", () => {
  it("normalizes contact details", () => {
    expect(emailSchema.parse("  Pessoa@EXAMPLE.org ")).toBe("pessoa@example.org");
    expect(phoneSchema.parse("(85) 99999-9999")).toBe("85999999999");
  });

  it("validates CPF and CNPJ check digits", () => {
    expect(documentSchema.parse("529.982.247-25")).toBe("52998224725");
    expect(documentSchema.parse("11.222.333/0001-81")).toBe("11222333000181");
    expect(documentSchema.safeParse("111.111.111-11").success).toBe(false);
  });

  it("keeps money and quantities as exact normalized strings", () => {
    expect(moneySchema.parse("1.234,50")).toBe("1234.50");
    expect(quantitySchema.parse("2,125")).toBe("2.125");
    expect(() => normalizeDecimal("1,001", 2)).toThrow("at most 2 places");
  });

  it("rejects zero values and impossible calendar dates", () => {
    expect(moneySchema.safeParse("0").success).toBe(false);
    expect(quantitySchema.safeParse("0").success).toBe(false);
    expect(calendarDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(calendarDateSchema.parse("2026-08-06")).toBe("2026-08-06");
  });
});
