import { useCallback, useEffect, useMemo, useState } from "react";
import type { TenderPayload, TenderType } from "../types";

type UseTenderSelectionOptions = {
  open: boolean;
  total: number;
  defaultMethod: TenderType;
  defaultCardAmountInput?: string;
};

export function useTenderSelection({
  open,
  total,
  defaultMethod,
  defaultCardAmountInput = "",
}: UseTenderSelectionOptions) {
  const [method, setMethod] = useState<TenderType>(defaultMethod);
  const [cardAmountInput, setCardAmountInput] = useState(defaultCardAmountInput);

  useEffect(() => {
    if (!open) return;
    setMethod(defaultMethod);
    setCardAmountInput(defaultCardAmountInput);
  }, [open, defaultMethod, defaultCardAmountInput]);

  const cardAmount = useMemo(() => {
    if (method !== "SPLIT") return total;
    const parsed = Number(cardAmountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [method, cardAmountInput, total]);

  const cashRemainder = useMemo(() => {
    if (method !== "SPLIT") return 0;
    return Math.max(0, Math.round((total - cardAmount) * 100) / 100);
  }, [method, cardAmount, total]);

  const splitInvalid =
    method === "SPLIT" && (cardAmount <= 0 || cardAmount >= total);

  const buildTender = useCallback((): TenderPayload => {
    if (method === "SPLIT") {
      return { method: "SPLIT", cardAmount };
    }
    return { method };
  }, [method, cardAmount]);

  return {
    method,
    setMethod,
    cardAmountInput,
    setCardAmountInput,
    cardAmount,
    cashRemainder,
    splitInvalid,
    buildTender,
  };
}
