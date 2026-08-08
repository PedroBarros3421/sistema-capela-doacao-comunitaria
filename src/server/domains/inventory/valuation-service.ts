import { Decimal } from "@prisma/client/runtime/client";

import { ValidationError } from "@/server/http/errors";

type ValuationInput = {
  quantity: string;
  averageUnitValue: string | Decimal;
  valuationSource?: "MANUAL" | "AVERAGE_AT_RECEIPT";
  estimatedValue?: string;
};

export type LotValuation = {
  estimatedValue: string;
  valuationSource: "MANUAL" | "AVERAGE_AT_RECEIPT";
  unitValueSnapshot: string | null;
};

export function calculateLotValuation(input: ValuationInput): LotValuation {
  const quantity = new Decimal(input.quantity);
  if (quantity.lte(0)) throw new ValidationError("A quantidade deve ser maior que zero");

  const source = input.valuationSource ?? (input.estimatedValue ? "MANUAL" : "AVERAGE_AT_RECEIPT");
  if (source === "MANUAL") {
    if (input.estimatedValue === undefined) {
      throw new ValidationError("Informe o valor estimado para valoração manual");
    }
    const estimatedValue = new Decimal(input.estimatedValue);
    if (estimatedValue.lt(0)) throw new ValidationError("O valor estimado não pode ser negativo");
    return { estimatedValue: estimatedValue.toFixed(2), valuationSource: source, unitValueSnapshot: null };
  }

  const average = new Decimal(input.averageUnitValue);
  if (average.lt(0)) throw new ValidationError("O valor médio não pode ser negativo");
  return {
    estimatedValue: quantity.mul(average).toDecimalPlaces(2).toFixed(2),
    valuationSource: source,
    unitValueSnapshot: average.toFixed(2),
  };
}
