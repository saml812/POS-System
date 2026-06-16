import { useEffect, useState } from "react";
import { useLocale } from "../../context/LocaleContext";
import { useTenderSelection } from "../../hooks/useTenderSelection";
import type { TenderPayload } from "../../types";
import { formatMoney } from "../../utils/order";
import { TenderFields } from "../checkout/TenderFields";

export type CheckoutOrderType = "walk-in" | "call-in";

type CheckoutModalProps = {
  open: boolean;
  total: number;
  ticketNumber?: number;
  mode: "place" | "collect";
  busy?: boolean;
  onClose: () => void;
  onPlaceWalkIn: (tender: TenderPayload) => void;
  onPlaceCallIn: () => void;
  onConfirmPaid: (tender: TenderPayload) => void;
};

export function CheckoutModal({
  open,
  total,
  ticketNumber,
  mode,
  busy = false,
  onClose,
  onPlaceWalkIn,
  onPlaceCallIn,
  onConfirmPaid,
}: CheckoutModalProps) {
  const { t } = useLocale();
  const [orderType, setOrderType] = useState<CheckoutOrderType>("walk-in");
  const {
    method,
    setMethod,
    cardAmountInput,
    setCardAmountInput,
    cashRemainder,
    splitInvalid,
    buildTender,
  } = useTenderSelection({ open, total, defaultMethod: "CARD" });

  useEffect(() => {
    if (!open) return;
    setOrderType("walk-in");
  }, [open, mode]);

  const payAtPickup = orderType === "call-in";

  if (!open) return null;

  function handlePrimary() {
    if (mode === "place" && payAtPickup) {
      onPlaceCallIn();
      return;
    }

    const tender = buildTender();
    if (mode === "place") {
      onPlaceWalkIn(tender);
    } else {
      onConfirmPaid(tender);
    }
  }

  return (
    <div className="dd-modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="dd-modal checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="checkout-title">
          {mode === "collect" ? t("checkout.confirmPickupTitle") : t("checkout.title")}
        </h3>

        {ticketNumber != null ? (
          <p className="checkout-ticket muted">
            {t("order.ticket", { num: ticketNumber })}
          </p>
        ) : null}

        <p className="dd-modal-total">
          {t("common.total")}: <strong>{formatMoney(total)}</strong>
        </p>

        {mode === "place" ? (
          <div className="checkout-order-type">
            <span className="checkout-methods-label">{t("checkout.orderTypeLabel")}</span>
            <div className="checkout-order-type-grid">
              <button
                type="button"
                className={`checkout-order-type-btn ${orderType === "walk-in" ? "active" : ""}`}
                disabled={busy}
                onClick={() => setOrderType("walk-in")}
              >
                <span className="checkout-order-type-title">{t("checkout.walkIn")}</span>
                <span className="checkout-order-type-desc">{t("checkout.walkInDesc")}</span>
              </button>
              <button
                type="button"
                className={`checkout-order-type-btn checkout-order-type-btn-callin ${orderType === "call-in" ? "active" : ""}`}
                disabled={busy}
                onClick={() => setOrderType("call-in")}
              >
                <span className="checkout-order-type-title">{t("checkout.callIn")}</span>
                <span className="checkout-order-type-desc">{t("checkout.callInDesc")}</span>
              </button>
            </div>
          </div>
        ) : null}

        {!payAtPickup || mode === "collect" ? (
          <TenderFields
            method={method}
            onMethodChange={setMethod}
            cardAmountInput={cardAmountInput}
            onCardAmountInputChange={setCardAmountInput}
            cashRemainder={cashRemainder}
            total={total}
            hint={t("checkout.manualHint")}
            label={t("checkout.tenderLabel")}
            busy={busy}
          />
        ) : (
          <div className="checkout-callin-panel" role="status">
            <span className="checkout-callin-icon" aria-hidden>
              📞
            </span>
            <div>
              <p className="checkout-callin-panel-title">{t("checkout.callIn")}</p>
              <p className="checkout-callin-panel-desc">{t("checkout.callInDesc")}</p>
            </div>
          </div>
        )}

        {busy ? (
          <p className="checkout-processing">{t("checkout.saving")}</p>
        ) : null}

        <div className="dd-modal-footer checkout-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-brand"
            disabled={busy || (!payAtPickup && splitInvalid)}
            onClick={handlePrimary}
          >
            {busy
              ? t("checkout.saving")
              : mode === "place" && payAtPickup
                ? t("checkout.callInPlaceOrder")
                : t("checkout.confirmPaid")}
          </button>
        </div>
      </div>
    </div>
  );
}
