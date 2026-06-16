import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../context/LocaleContext";
import type { PaymentMethod, PaymentPayload } from "../../types";
import { formatMoney } from "../../utils/order";

export type CheckoutStep = "payment" | "split-cash";
export type CheckoutOrderType = "walk-in" | "call-in";

type CheckoutModalProps = {
  open: boolean;
  total: number;
  ticketNumber?: number;
  mode: "place" | "collect";
  step?: CheckoutStep;
  splitCardAmount?: number;
  splitCashAmount?: number;
  busy?: boolean;
  onClose: () => void;
  onPlaceWalkIn: (payment: PaymentPayload) => void;
  onPlaceCallIn: () => void;
  onCollect: (payment: PaymentPayload) => void;
  onConfirmSplitCash: () => void;
  onVoidCard?: () => void;
};

export function CheckoutModal({
  open,
  total,
  ticketNumber,
  mode,
  step = "payment",
  splitCardAmount = 0,
  splitCashAmount = 0,
  busy = false,
  onClose,
  onPlaceWalkIn,
  onPlaceCallIn,
  onCollect,
  onConfirmSplitCash,
  onVoidCard,
}: CheckoutModalProps) {
  const { t } = useLocale();
  const [orderType, setOrderType] = useState<CheckoutOrderType>("walk-in");
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [cardAmountInput, setCardAmountInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrderType("walk-in");
    setMethod("CARD");
    setCardAmountInput("");
  }, [open, mode]);

  const payAtPickup = orderType === "call-in";

  const cardAmount = useMemo(() => {
    if (method !== "SPLIT") return total;
    const parsed = Number(cardAmountInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [method, cardAmountInput, total]);

  const cashRemainder = useMemo(() => {
    if (method !== "SPLIT") return 0;
    return Math.max(0, Math.round((total - cardAmount) * 100) / 100);
  }, [method, cardAmount, total]);

  if (!open) return null;

  function buildPayment(): PaymentPayload {
    if (method === "SPLIT") {
      return { method: "SPLIT", cardAmount: cardAmount };
    }
    return { method };
  }

  function handlePrimary() {
    if (step === "split-cash") {
      onConfirmSplitCash();
      return;
    }

    if (mode === "place" && payAtPickup) {
      onPlaceCallIn();
      return;
    }

    const payment = buildPayment();
    if (mode === "place") {
      onPlaceWalkIn(payment);
    } else {
      onCollect(payment);
    }
  }

  const splitInvalid =
    method === "SPLIT" &&
    step === "payment" &&
    (cardAmount <= 0 || cardAmount >= total);

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
          {step === "split-cash"
            ? t("payment.splitCashTitle")
            : mode === "collect"
              ? t("payment.collectTitle")
              : t("payment.checkoutTitle")}
        </h3>

        {ticketNumber != null ? (
          <p className="checkout-ticket muted">
            {t("order.ticket", { num: ticketNumber })}
          </p>
        ) : null}

        <p className="dd-modal-total">
          {t("common.total")}: <strong>{formatMoney(total)}</strong>
        </p>

        {step === "split-cash" ? (
          <div className="checkout-split-cash">
            <p>{t("payment.splitCashPrompt", { amount: formatMoney(splitCashAmount) })}</p>
            <p className="muted">
              {t("payment.splitCardCharged", { amount: formatMoney(splitCardAmount) })}
            </p>
            {onVoidCard ? (
              <button
                type="button"
                className="btn btn-small btn-danger checkout-void-card"
                disabled={busy}
                onClick={onVoidCard}
              >
                {t("payment.voidCard")}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {mode === "place" ? (
              <div className="checkout-order-type">
                <span className="checkout-methods-label">{t("payment.orderTypeLabel")}</span>
                <div className="checkout-order-type-grid">
                  <button
                    type="button"
                    className={`checkout-order-type-btn ${orderType === "walk-in" ? "active" : ""}`}
                    disabled={busy}
                    onClick={() => setOrderType("walk-in")}
                  >
                    <span className="checkout-order-type-title">{t("payment.walkIn")}</span>
                    <span className="checkout-order-type-desc">{t("payment.walkInDesc")}</span>
                  </button>
                  <button
                    type="button"
                    className={`checkout-order-type-btn checkout-order-type-btn-callin ${orderType === "call-in" ? "active" : ""}`}
                    disabled={busy}
                    onClick={() => setOrderType("call-in")}
                  >
                    <span className="checkout-order-type-title">{t("payment.callIn")}</span>
                    <span className="checkout-order-type-desc">{t("payment.callInDesc")}</span>
                  </button>
                </div>
              </div>
            ) : null}

            {!payAtPickup || mode === "collect" ? (
              <div className="checkout-methods">
                <span className="checkout-methods-label">{t("payment.method")}</span>
                <div className="checkout-method-grid">
                  {(["CASH", "CARD", "SPLIT"] as PaymentMethod[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`checkout-method-btn ${method === value ? "active" : ""}`}
                      disabled={busy}
                      onClick={() => setMethod(value)}
                    >
                      {t(`payment.methods.${value}`)}
                    </button>
                  ))}
                </div>

                {method === "SPLIT" ? (
                  <label className="checkout-split-field">
                    <span>{t("payment.cardAmount")}</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={total - 0.01}
                      className="dd-input"
                      value={cardAmountInput}
                      onChange={(e) => setCardAmountInput(e.target.value)}
                      disabled={busy}
                    />
                    <span className="muted">
                      {t("payment.cashRemainder", { amount: formatMoney(cashRemainder) })}
                    </span>
                  </label>
                ) : null}
              </div>
            ) : (
              <div className="checkout-callin-panel" role="status">
                <span className="checkout-callin-icon" aria-hidden>
                  📞
                </span>
                <div>
                  <p className="checkout-callin-panel-title">{t("payment.callIn")}</p>
                  <p className="checkout-callin-panel-desc">{t("payment.callInDesc")}</p>
                </div>
              </div>
            )}
          </>
        )}

        {busy ? (
          <p className="checkout-processing">{t("payment.processing")}</p>
        ) : null}

        <div className="dd-modal-footer checkout-footer">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-brand"
            disabled={busy || (step === "payment" && !payAtPickup && splitInvalid)}
            onClick={handlePrimary}
          >
            {busy
              ? t("payment.processing")
              : step === "split-cash"
                ? t("payment.confirmCash")
                : mode === "place" && payAtPickup
                  ? t("payment.callInPlaceOrder")
                  : mode === "collect"
                    ? t("payment.collect")
                    : t("placeOrder.placeOrder")}
          </button>
        </div>
      </div>
    </div>
  );
}
