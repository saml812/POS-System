import { useCallback, useState } from "react";
import { confirmPaid } from "../api/orders";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "./useAsyncAction";
import type { Order, TenderPayload } from "../types";

type UseCollectCheckoutOptions = {
  onAfter: () => Promise<void>;
  errorMessage: string;
};

export function useCollectCheckout({
  onAfter,
  errorMessage,
}: UseCollectCheckoutOptions) {
  const { t } = useLocale();
  const { busy, run, success, setSuccess } = useAsyncAction(errorMessage);

  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setOrder(null);
  }, [busy]);

  const openForOrder = useCallback((next: Order) => {
    setOrder(next);
    setOpen(true);
  }, []);

  const handleConfirmPaid = useCallback(
    async (tender: TenderPayload) => {
      if (!order) return;

      await run(
        async () => {
          await confirmPaid(order.id, tender);
          close();
          setSuccess(t("checkout.confirmed"));
          await onAfter();
        },
        { busyId: order.id },
      );
    },
    [close, onAfter, order, run, setSuccess, t],
  );

  return {
    open,
    order,
    busy,
    success,
    close,
    openForOrder,
    handleConfirmPaid,
  };
}
