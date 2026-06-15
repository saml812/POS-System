import { useCallback, useMemo, useState } from "react";
import {
  cancelOrder,
  finishOrder,
  getKitchenFeed,
  startOrder,
} from "../api/orders";
import { CancelOrderForm } from "../components/CancelOrderForm";
import { FeedHero } from "../components/feed/FeedHero";
import { OrderCard } from "../components/OrderCard";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useOrderFeed } from "../hooks/useOrderFeed";
import type { OrderSocketEvent } from "../hooks/useOrderSocket";
import { useNotificationSound } from "../hooks/useNotificationSound";
import { canViewKitchen } from "../lib/permissions";
import type { Order, OrderStatus } from "../types";
import { applyKitchenOrderEvent, orderStatusLabel } from "../utils/order";

type KitchenFilter = "ALL" | OrderStatus;

const KITCHEN_FILTERS: KitchenFilter[] = [
  "ALL",
  "PENDING",
  "IN_PROGRESS",
  "FINISHED",
  "CANCELLED",
];

export function KitchenFeedPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canView = canViewKitchen(user);

  const [includeVoided, setIncludeVoided] = useState(false);
  const [activeFilter, setActiveFilter] = useState<KitchenFilter>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadFeed = useCallback(
    () => getKitchenFeed(includeVoided),
    [includeVoided],
  );

  const { playNotificationSound } = useNotificationSound();

  const applyEvent = useCallback(
    (orders: Order[], order: Order) =>
      applyKitchenOrderEvent(orders, order, includeVoided),
    [includeVoided],
  );

  const onOrderEvent = useCallback(
    (event: OrderSocketEvent, order: Order) => {
      if (event === "order:created" && order.status === "PENDING") {
        playNotificationSound();
      }
    },
    [playNotificationSound],
  );

  const { orders, loading, error, setError, reload } = useOrderFeed({
    enabled: canView,
    load: loadFeed,
    room: "kitchen",
    applyEvent,
    onOrderEvent,
  });

  const { success, actionId, clearMessages, run } = useAsyncAction(
    t("common.actionFailed"),
  );

  const visibleOrders = useMemo(() => {
    let list = orders;
    if (!includeVoided) {
      list = list.filter((order) => order.status !== "CANCELLED");
    }
    if (activeFilter === "ALL") return list;
    return list.filter((order) => order.status === activeFilter);
  }, [orders, includeVoided, activeFilter]);

  const counts = useMemo(() => {
    const base = includeVoided
      ? orders
      : orders.filter((order) => order.status !== "CANCELLED");
    return {
      all: base.length,
      pending: base.filter((order) => order.status === "PENDING").length,
      inProgress: base.filter((order) => order.status === "IN_PROGRESS").length,
      finished: base.filter((order) => order.status === "FINISHED").length,
      cancelled: orders.filter((order) => order.status === "CANCELLED").length,
    };
  }, [orders, includeVoided]);

  function filterCount(filter: KitchenFilter) {
    if (filter === "ALL") return counts.all;
    if (filter === "PENDING") return counts.pending;
    if (filter === "IN_PROGRESS") return counts.inProgress;
    if (filter === "FINISHED") return counts.finished;
    return counts.cancelled;
  }

  async function handleCancel(orderId: string, reason?: string) {
    await run(
      () => cancelOrder(orderId, reason),
      {
        successMessage: t("kitchen.cancelledSuccess"),
        onAfter: reload,
      },
    );
    setCancellingId(null);
    setIncludeVoided(true);
    setActiveFilter("CANCELLED");
  }

  return (
    <div className="page ft-page">
      <FeedHero
        title={t("kitchen.title")}
        subtitle={t("kitchen.subtitle")}
        loading={loading}
        onRefresh={() => reload().catch((err: Error) => setError(err.message))}
      />

      {!canView ? <Banner variant="warning">{t("kitchen.roleWarning")}</Banner> : null}

      {canView && !loading ? (
        <div className="ft-stats">
          <div className="ft-stat ft-stat-pending">
            <span className="ft-stat-value">{counts.pending}</span>
            <span className="ft-stat-label">{t("order.status.PENDING")}</span>
          </div>
          <div className="ft-stat ft-stat-progress">
            <span className="ft-stat-value">{counts.inProgress}</span>
            <span className="ft-stat-label">{t("order.status.IN_PROGRESS")}</span>
          </div>
          <div className="ft-stat ft-stat-ready">
            <span className="ft-stat-value">{counts.finished}</span>
            <span className="ft-stat-label">{t("order.status.FINISHED")}</span>
          </div>
        </div>
      ) : null}

      {canView ? (
        <>
          <nav className="ft-filter-nav" aria-label={t("kitchen.filterLabel")}>
            {KITCHEN_FILTERS.map((filter) => {
              if (filter === "CANCELLED" && !includeVoided) return null;
              return (
                <button
                  key={filter}
                  type="button"
                  className={`ft-filter-pill ${activeFilter === filter ? "active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter === "ALL"
                    ? t("kitchen.filterAll")
                    : orderStatusLabel(filter, t)}
                  <span className="ft-filter-count">{filterCount(filter)}</span>
                </button>
              );
            })}
          </nav>

          <label className="ft-checkbox">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={(e) => setIncludeVoided(e.target.checked)}
            />
            <span>{t("kitchen.showCancelled")}</span>
          </label>
        </>
      ) : null}

      {loading ? <p className="ft-loading">{t("kitchen.loading")}</p> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}
      {success ? <Banner variant="success">{success}</Banner> : null}

      {canView && !loading && visibleOrders.length === 0 ? (
        <div className="ft-empty">
          <span className="ft-empty-icon" aria-hidden>
            🍳
          </span>
          <p>{t("kitchen.empty")}</p>
        </div>
      ) : null}

      {canView && !loading && visibleOrders.length > 0 ? (
        <div className="ft-ticket-grid">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              actions={
                canView &&
                order.status !== "CANCELLED" &&
                order.status !== "FINISHED" ? (
                  <div className="ft-action-stack">
                    {order.status === "PENDING" ? (
                      <button
                        type="button"
                        className="btn btn-brand ft-action-primary"
                        disabled={actionId !== null}
                        onClick={() =>
                          run(() => startOrder(order.id), { onAfter: reload })
                        }
                      >
                        {t("kitchen.start")}
                      </button>
                    ) : null}
                    {order.status === "IN_PROGRESS" ? (
                      <button
                        type="button"
                        className="btn btn-brand ft-action-primary"
                        disabled={actionId !== null}
                        onClick={() =>
                          run(() => finishOrder(order.id), { onAfter: reload })
                        }
                      >
                        {t("kitchen.markFinished")}
                      </button>
                    ) : null}
                    {cancellingId === order.id ? (
                      <CancelOrderForm
                        busy={actionId !== null}
                        onConfirm={(reason) => handleCancel(order.id, reason)}
                        onDismiss={() => setCancellingId(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        className="btn ft-action-danger"
                        disabled={actionId !== null}
                        onClick={() => {
                          setCancellingId(order.id);
                          clearMessages();
                        }}
                      >
                        {t("order.cancel.order")}
                      </button>
                    )}
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
