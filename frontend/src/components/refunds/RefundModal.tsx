import { useMemo } from "react";
import { useLocale } from "../../context/LocaleContext";
import { useTenderSelection } from "../../hooks/useTenderSelection";
import type { RefundPayload, TenderType } from "../../types";
import { formatMoney } from "../../utils/order";
import { TenderFields } from "../checkout/TenderFields";

type RefundModalProps = {
  open: boolean;
  total: number;
  originalTenderType: TenderType | null;
  originalCardAmount: number;
  originalCashAmount: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (refund: RefundPayload) => void;
};

export function RefundModal({
  open,
  total,
  originalTenderType,
  originalCardAmount,
  originalCashAmount,
  busy = false,
  onClose,
  onConfirm,
}: RefundModalProps) {
  const { t } = useLocale();
  const defaultMethod =
    originalTenderType ?? (originalCardAmount > 0 ? "CARD" : "CASH");
  const defaultCardAmountInput =
    defaultMethod === "SPLIT" ? String(originalCardAmount) : "";

  const {
    method,
    setMethod,
    cardAmountInput,
    setCardAmountInput,
    cashRemainder,
    splitInvalid,
    buildTender,
  } = useTenderSelection({
    open,
    total,
    defaultMethod,
    defaultCardAmountInput,
  });

  const originalPaidSummary = useMemo(
    () =>
      formatOriginalPaid(
        t,
        originalTenderType,
        originalCardAmount,
        originalCashAmount,
      ),
    [t, originalTenderType, originalCardAmount, originalCashAmount],
  );

  if (!open) return null;

  return (
    <div className="dd-modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="dd-modal checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="refund-title">{t("refunds.modalTitle")}</h3>

        <p className="dd-modal-total">
          {t("common.total")}: <strong>{formatMoney(total)}</strong>
        </p>

        <p className="checkout-manual-hint muted">
          {t("refunds.originalPaid", { summary: originalPaidSummary })}
        </p>

        <TenderFields
          method={method}
          onMethodChange={setMethod}
          cardAmountInput={cardAmountInput}
          onCardAmountInputChange={setCardAmountInput}
          cashRemainder={cashRemainder}
          total={total}
          hint={t("refunds.manualHint")}
          label={t("refunds.tenderLabel")}
          busy={busy}
        />

        {busy ? <p className="checkout-processing">{t("checkout.saving")}</p> : null}

        <div className="dd-modal-footer checkout-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-brand"
            disabled={busy || splitInvalid}
            onClick={() => onConfirm(buildTender())}
          >
            {busy ? t("checkout.saving") : t("refunds.confirmRefund")}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatOriginalPaid(
  t: (key: string, vars?: Record<string, string>) => string,
  tenderType: TenderType | null,
  cardAmount: number,
  cashAmount: number,
) {
  if (tenderType === "CASH") {
    return t("checkout.tenders.CASH");
  }
  if (tenderType === "CARD") {
    return `${t("checkout.tenders.CARD")} ${formatMoney(cardAmount)}`;
  }
  if (tenderType === "SPLIT") {
    return t("refunds.splitSummary", {
      card: formatMoney(cardAmount),
      cash: formatMoney(cashAmount),
    });
  }
  return formatMoney(cardAmount + cashAmount);
}
