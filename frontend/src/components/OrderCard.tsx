import type { ReactNode } from "react";
import { useLocale } from "../context/LocaleContext";
import type { Order } from "../types";
import {
  formatItemLabel,
  formatMoney,
  formatOptionNames,
  formatTime,
  orderStatusLabel,
  orderTotal,
  paidStatusLabel,
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
  const paidBadgeClass = order.paidStatus.toLowerCase();
  const showPaidBadge =
    order.payAtPickup ||
    order.paidStatus !== "PAID" ||
    order.tenderType != null;

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
          {showPaidBadge ? (
            <span
              className={`ft-paid-pill paid-${paidBadgeClass} ${order.payAtPickup ? "call-in" : ""}`}
            >
              {paidStatusLabel(order, t)}
            </span>
          ) : null}
        </div>
      </header>

      {meta ? <div className="ft-ticket-extra">{meta}</div> : null}

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
