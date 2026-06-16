import { useCallback, useState } from "react";
import {
  collectPayment,
  confirmOrderCash,
  retryPayment,
  voidCardPortion,
} from "../api/orders";
import { useLocale } from "../context/LocaleContext";
import type { CheckoutStep } from "../components/place-order/CheckoutModal";
import { useAsyncAction } from "./useAsyncAction";
import type { Order, PaymentPayload } from "../types";
import { isSplitAwaitingCash } from "../utils/order";

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
  const [step, setStep] = useState<CheckoutStep>("payment");
  const [order, setOrder] = useState<Order | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setOrder(null);
    setStep("payment");
  }, [busy]);

  const openForOrder = useCallback((next: Order) => {
    setOrder(next);
    setStep(isSplitAwaitingCash(next) ? "split-cash" : "payment");
    setOpen(true);
  }, []);

  const handleCollect = useCallback(
    async (payment: PaymentPayload) => {
      if (!order) return;

      await run(
        async () => {
          const action =
            order.paymentStatus === "FAILED" ? retryPayment : collectPayment;
          const { order: updated } = await action(order.id, payment);

          if (isSplitAwaitingCash(updated)) {
            setOrder(updated);
            setStep("split-cash");
          } else {
            close();
            setSuccess(t("payment.collected"));
          }

          await onAfter();
        },
        { busyId: order.id },
      );
    },
    [close, onAfter, order, run, setSuccess, t],
  );

  const handleConfirmSplitCash = useCallback(async () => {
    if (!order) return;

    await run(
      async () => {
        await confirmOrderCash(order.id);
        close();
        await onAfter();
      },
      { busyId: order.id, successMessage: t("payment.collected") },
    );
  }, [close, onAfter, order, run, t]);

  const handleVoidCard = useCallback(async () => {
    if (!order) return;

    await run(
      async () => {
        await voidCardPortion(order.id);
        close();
        await onAfter();
      },
      { busyId: order.id, successMessage: t("payment.voidCardSuccess") },
    );
  }, [close, onAfter, order, run, t]);

  return {
    open,
    step,
    order,
    busy,
    success,
    close,
    openForOrder,
    handleCollect,
    handleConfirmSplitCash,
    handleVoidCard,
  };
}
