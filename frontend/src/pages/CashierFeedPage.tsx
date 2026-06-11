import { useCallback } from "react";
import { completeOrder, getCashierFeed } from "../api/orders";
import { FeedHero } from "../components/feed/FeedHero";
import { OrderCard } from "../components/OrderCard";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useOrderFeed } from "../hooks/useOrderFeed";
import { canViewCashier } from "../lib/permissions";
import type { Order } from "../types";
import { applyCashierOrderEvent, formatTime } from "../utils/order";

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

  const { actionId, run } = useAsyncAction(t("cashier.completeFailed"));

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
        <div className="ft-stats ft-stats-cashier">
          <div className="ft-stat ft-stat-ready">
            <span className="ft-stat-value">{orders.length}</span>
            <span className="ft-stat-label">{t("cashier.readyOrders")}</span>
          </div>
          <div className="ft-stat">
            <span className="ft-stat-value">{totalItems}</span>
            <span className="ft-stat-label">{t("cashier.readyItems")}</span>
          </div>
        </div>
      ) : null}

      {loading ? <p className="ft-loading">{t("cashier.loading")}</p> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}

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
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              meta={
                order.finishedAt ? (
                  <p className="ft-ticket-ready-meta">
                    {t("cashier.finished", {
                      time: formatTime(order.finishedAt, locale),
                      by: order.finishedBy
                        ? t("cashier.finishedBy", {
                            email: order.finishedBy.email,
                          })
                        : "",
                    })}
                  </p>
                ) : null
              }
              actions={
                canView ? (
                  <button
                    type="button"
                    className="btn btn-brand ft-action-primary ft-action-full"
                    disabled={actionId !== null}
                    onClick={() =>
                      run(() => completeOrder(order.id), {
                        busyId: order.id,
                        onAfter: reload,
                      })
                    }
                  >
                    {actionId === order.id
                      ? t("cashier.completing")
                      : t("cashier.complete")}
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
