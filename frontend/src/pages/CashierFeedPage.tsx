import { useCallback } from "react";
import { completeOrder, getCashierFeed } from "../api/orders";
import { FeedHero } from "../components/feed/FeedHero";
import { OrderCard } from "../components/OrderCard";
import { CheckoutModal } from "../components/place-order/CheckoutModal";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useCollectCheckout } from "../hooks/useCollectCheckout";
import { useOrderFeed } from "../hooks/useOrderFeed";
import { canViewCashier } from "../lib/permissions";
import type { Order } from "../types";
import {
  applyCashierOrderEvent,
  formatTime,
  isOrderPaid,
  needsCollectPayment,
  orderTotal,
} from "../utils/order";

export function CashierFeedPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const canView = canViewCashier(user);

  const loadFeed = useCallback(() => getCashierFeed(), []);

  const applyEvent = useCallback(
    (orders: Order[], order: Order) => applyCashierOrderEvent(orders, order),
    [],
  );

  const { orders, loading, error, setError, reload } = useOrderFeed({
    enabled: canView,
    load: loadFeed,
    room: "cashier",
    applyEvent,
  });

  const checkout = useCollectCheckout({
    onAfter: reload,
    errorMessage: t("cashier.completeFailed"),
  });

  const { actionId, busy, run, success } = useAsyncAction(
    t("cashier.completeFailed"),
  );

  const totalItems = orders.reduce(
    (sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  return (
    <div className="page ft-page">
      <FeedHero
        title={t("cashier.title")}
        subtitle={t("cashier.subtitle")}
        loading={loading}
        onRefresh={() => reload().catch((err: Error) => setError(err.message))}
      />

      {!canView ? <Banner variant="warning">{t("cashier.roleWarning")}</Banner> : null}

      {canView && !loading ? (
        <div className="ft-stats">
          <div className="ft-stat ft-stat-ready">
            <span className="ft-stat-value">{orders.length}</span>
            <span className="ft-stat-label">{t("cashier.readyCount")}</span>
          </div>
          <div className="ft-stat">
            <span className="ft-stat-value">{totalItems}</span>
            <span className="ft-stat-label">{t("cashier.itemCount")}</span>
          </div>
        </div>
      ) : null}

      {loading ? <p className="ft-loading">{t("cashier.loading")}</p> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}
      {success ? <Banner variant="success">{success}</Banner> : null}
      {checkout.success ? <Banner variant="success">{checkout.success}</Banner> : null}

      {canView && !loading && orders.length === 0 ? (
        <div className="ft-empty">
          <span className="ft-empty-icon" aria-hidden>
            🧾
          </span>
          <p>{t("cashier.empty")}</p>
          <p className="muted">{t("cashier.emptyDesc")}</p>
        </div>
      ) : null}

      {canView && !loading && orders.length > 0 ? (
        <div className="ft-ticket-grid">
          {orders.map((order) => {
            const paid = isOrderPaid(order);
            const isBusy = busy && actionId === order.id;
            const canCollect = needsCollectPayment(order) && order.payAtPickup;

            return (
              <OrderCard
                key={order.id}
                order={order}
                meta={
                  order.finishedAt ? (
                    <p className="ft-ticket-meta">
                      {t("cashier.finished", {
                        time: formatTime(order.finishedAt, locale),
                      })}
                      {order.finishedBy
                        ? t("cashier.finishedBy", {
                            email: order.finishedBy.email,
                          })
                        : ""}
                    </p>
                  ) : null
                }
                actions={
                  <div className="ft-action-stack">
                    {!paid && canCollect ? (
                      <button
                        type="button"
                        className="btn btn-brand ft-action-primary"
                        disabled={isBusy || checkout.busy}
                        onClick={() => checkout.openForOrder(order)}
                      >
                        {t("payment.collect")}
                      </button>
                    ) : !paid ? (
                      <p className="ft-payment-error muted">
                        {t("cashier.unpaidWarning")}
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-brand ft-action-primary"
                        disabled={isBusy || checkout.busy}
                        onClick={() =>
                          run(() => completeOrder(order.id), {
                            busyId: order.id,
                            successMessage: t("cashier.completeSuccess"),
                            onAfter: reload,
                          })
                        }
                      >
                        {isBusy ? t("cashier.completing") : t("cashier.complete")}
                      </button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : null}

      <CheckoutModal
        open={checkout.open}
        total={checkout.order ? orderTotal(checkout.order) : 0}
        ticketNumber={checkout.order?.ticketNumber}
        mode="collect"
        step={checkout.step}
        splitCardAmount={checkout.order?.cardAmount ?? 0}
        splitCashAmount={checkout.order?.cashAmount ?? 0}
        busy={checkout.busy}
        onClose={checkout.close}
        onPlaceWalkIn={() => undefined}
        onPlaceCallIn={() => undefined}
        onCollect={checkout.handleCollect}
        onConfirmSplitCash={checkout.handleConfirmSplitCash}
        onVoidCard={
          checkout.step === "split-cash" && checkout.order
            ? checkout.handleVoidCard
            : undefined
        }
      />
    </div>
  );
}
