import { z } from "zod";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function normalizePhone(value: string): string {
  return digitsOnly(value);
}

export function normalizeDocument(value: string): string {
  return digitsOnly(value);
}

function hasValidCheckDigits(document: string): boolean {
  if (/^(\d)\1+$/.test(document)) return false;

  if (document.length === 11) {
    const calculate = (length: number) => {
      const sum = document
        .slice(0, length)
        .split("")
        .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return calculate(9) === Number(document[9]) && calculate(10) === Number(document[10]);
  }

  if (document.length === 14) {
    const calculate = (base: string, weights: number[]) => {
      const sum = base
        .split("")
        .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = calculate(document.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculate(`${document.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return document.endsWith(`${first}${second}`);
  }

  return false;
}

export function normalizeDecimal(value: string | number, scale: 2 | 3): string {
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw) throw new Error("Decimal value is required");

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const hasDecimalSeparator = decimalIndex >= 0;
  const integerPart = hasDecimalSeparator ? raw.slice(0, decimalIndex) : raw;
  const fractionPart = hasDecimalSeparator ? raw.slice(decimalIndex + 1) : "";
  const integerDigits = integerPart.replace(/[.,]/g, "");

  if (!/^\d+$/.test(integerDigits) || (fractionPart && !/^\d+$/.test(fractionPart))) {
    throw new Error("Invalid decimal value");
  }
  if (fractionPart.length > scale) throw new Error(`Decimal value supports at most ${scale} places`);

  const normalizedInteger = integerDigits.replace(/^0+(?=\d)/, "") || "0";
  return `${normalizedInteger}.${fractionPart.padEnd(scale, "0")}`;
}

export const emailSchema = z.string().transform(normalizeEmail).pipe(z.email().max(254));

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\d{10,13}$/, "Telefone deve ter entre 10 e 13 dígitos"));

export const documentSchema = z
  .string()
  .transform(normalizeDocument)
  .refine(hasValidCheckDigits, "CPF ou CNPJ inválido");

export const moneySchema = z
  .union([z.string(), z.number().finite().nonnegative()])
  .transform((value, context) => {
    try {
      return normalizeDecimal(value, 2);
    } catch (error) {
      context.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  })
  .refine((value) => Number(value) > 0, "Valor deve ser positivo");

export const quantitySchema = z
  .union([z.string(), z.number().finite().nonnegative()])
  .transform((value, context) => {
    try {
      return normalizeDecimal(value, 3);
    } catch (error) {
      context.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  })
  .refine((value) => Number(value) > 0, "Quantidade deve ser positiva");

export const calendarDateSchema = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}, "Data inválida");

export const instantSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
