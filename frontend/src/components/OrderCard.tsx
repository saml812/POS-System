import type { ReactNode } from "react";
import { useLocale } from "../context/LocaleContext";
import type { Order } from "../types";
import {
  formatItemLabel,
  formatMoney,
  formatOptionNames,
  formatTime,
  isSplitAwaitingCash,
  orderStatusLabel,
  orderTotal,
  paymentStatusLabel,
} from "../utils/order";

type OrderCardProps = {
  order: Order;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function OrderCard({ order, actions, meta }: OrderCardProps) {
  const { locale, t } = useLocale();
  const total = orderTotal(order);
  const statusClass = order.status.toLowerCase();
  const paymentBadgeClass = order.paymentStatus.toLowerCase();
  const showPaymentBadge =
    order.payAtPickup ||
    order.paymentStatus !== "AUTHORIZED" ||
    order.paymentMethod != null;

  return (
    <article className={`ft-ticket status-${statusClass}`}>
      <header className="ft-ticket-header">
        <div className="ft-ticket-head">
          <span className="ft-ticket-number">
            {t("order.ticket", { num: order.ticketNumber })}
          </span>
          <p className="ft-ticket-meta">
            {t("order.placed", {
              time: formatTime(order.createdAt, locale),
              email: order.placedBy.email,
            })}
          </p>
        </div>
        <div className="ft-ticket-badges">
          <span className={`ft-status-pill status-${statusClass}`}>
            {orderStatusLabel(order.status, t)}
          </span>
          {showPaymentBadge ? (
            <span
              className={`ft-payment-pill payment-${paymentBadgeClass} ${order.payAtPickup ? "call-in" : ""}`}
            >
              {paymentStatusLabel(order, t)}
            </span>
          ) : null}
        </div>
      </header>

      {meta ? <div className="ft-ticket-extra">{meta}</div> : null}

      {order.paymentError ? (
        <p className="ft-payment-error">{order.paymentError}</p>
      ) : null}

      {isSplitAwaitingCash(order) ? (
        <p className="ft-payment-split muted">
          {t("payment.splitSummary", {
            card: formatMoney(order.cardAmount ?? 0),
            cash: formatMoney(order.cashAmount ?? 0),
          })}
        </p>
      ) : null}

      <ul className="ft-ticket-items">
        {order.items.map((item) => (
          <li key={item.id} className="ft-ticket-item">
            <div className="ft-ticket-item-info">
              <span className="ft-ticket-item-name">
                {formatItemLabel(item.name, item.itemCode, item.quantity)}
              </span>
              {item.sizeName ? (
                <span className="ft-ticket-item-size">{item.sizeName}</span>
              ) : null}
              {item.options?.length > 0 ? (
                <span className="ft-ticket-item-options">
                  {formatOptionNames(item.options)}
                </span>
              ) : null}
              {item.preferences ? (
                <span className="ft-ticket-item-prefs">{item.preferences}</span>
              ) : null}
            </div>
            <span className="ft-ticket-item-price">
              {formatMoney(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <footer className="ft-ticket-footer">
        <strong className="ft-ticket-total">
          {t("order.total", { amount: formatMoney(total) })}
        </strong>
        {actions ? <div className="ft-ticket-actions">{actions}</div> : null}
      </footer>

      {order.status === "CANCELLED" && order.cancelReason ? (
        <p className="ft-ticket-cancel-reason">
          {t("order.cancelled", { reason: order.cancelReason })}
        </p>
      ) : null}
    </article>
  );
}
