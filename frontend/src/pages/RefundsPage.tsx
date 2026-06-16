import { useState, type FormEvent } from "react";
import { getOrderByTicket, recordRefund } from "../api/orders";
import { OrderCard } from "../components/OrderCard";
import { RefundModal } from "../components/refunds/RefundModal";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { canRecordRefunds } from "../lib/permissions";
import type { Order, RefundPayload } from "../types";
import {
  canRecordRefund,
  formatMoney,
  formatTime,
  orderTotal,
} from "../utils/order";

export function RefundsPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const canView = canRecordRefunds(user);

  const [ticketInput, setTicketInput] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);

  const { error, success, busy, run } = useAsyncAction(t("refunds.failed"));

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSearchError("");

    const ticketNumber = Number(ticketInput.trim());
    if (!Number.isInteger(ticketNumber) || ticketNumber < 1) {
      setSearchError(t("refunds.invalidTicket"));
      setOrder(null);
      return;
    }

    try {
      const { order: found } = await getOrderByTicket(ticketNumber);
      setOrder(found);
    } catch (err) {
      setOrder(null);
      setSearchError(
        err instanceof Error ? err.message : t("refunds.notFound"),
      );
    }
  }

  async function handleRecordRefund(refund: RefundPayload) {
    if (!order) return;

    await run(
      async () => {
        const { order: updated } = await recordRefund(order.id, refund);
        setOrder(updated);
        setRefundOpen(false);
      },
      { successMessage: t("refunds.success") },
    );
  }

  const total = order ? orderTotal(order) : 0;
  const refundable = order ? canRecordRefund(order) : false;
  const refunded = order?.paidStatus === "REFUNDED";

  return (
    <div className="page ft-page refunds-page">
      <header className="ft-hero">
        <div className="ft-hero-text">
          <h1>{t("refunds.title")}</h1>
          <p>{t("refunds.subtitle")}</p>
        </div>
      </header>

      {!canView ? (
        <Banner variant="warning">{t("refunds.roleWarning")}</Banner>
      ) : null}

      {canView ? (
        <form className="refunds-search" onSubmit={handleSearch}>
          <label className="refunds-search-field">
            <span className="refunds-search-label">{t("refunds.ticketLabel")}</span>
            <div className="refunds-search-row">
              <input
                type="search"
                className="dd-input refunds-search-input"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                placeholder={t("refunds.ticketPlaceholder")}
                disabled={busy}
              />
              <button type="submit" className="btn btn-brand" disabled={busy}>
                {t("refunds.search")}
              </button>
            </div>
          </label>
        </form>
      ) : null}

      {searchError ? <Banner variant="error">{searchError}</Banner> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}
      {success ? <Banner variant="success">{success}</Banner> : null}

      {canView && order ? (
        <div className="refunds-result">
          <OrderCard
            order={order}
            meta={
              refunded && order.refundedAt ? (
                <p className="ft-ticket-meta">
                  {t("refunds.refundedAt", {
                    time: formatTime(order.refundedAt, locale),
                    email: order.refundedBy?.email ?? "",
                  })}
                  {order.refundTenderType === "SPLIT"
                    ? t("refunds.refundedAsSplit", {
                        card: formatMoney(order.refundedCardAmount ?? 0),
                        cash: formatMoney(order.refundedCashAmount ?? 0),
                      })
                    : order.refundTenderType
                      ? t("refunds.refundedAs", {
                          method: t(`checkout.tenders.${order.refundTenderType}`),
                        })
                      : ""}
                </p>
              ) : null
            }
            actions={
              refundable ? (
                <button
                  type="button"
                  className="btn btn-brand"
                  disabled={busy}
                  onClick={() => setRefundOpen(true)}
                >
                  {t("refunds.recordRefund")}
                </button>
              ) : refunded ? (
                <p className="muted">{t("refunds.alreadyRefunded")}</p>
              ) : (
                <p className="ft-checkout-warning muted">
                  {t("refunds.notEligible")}
                </p>
              )
            }
          />
        </div>
      ) : null}

      {order && refundable ? (
        <RefundModal
          open={refundOpen}
          total={total}
          originalTenderType={order.tenderType}
          originalCardAmount={order.cardAmount ?? 0}
          originalCashAmount={order.cashAmount ?? 0}
          busy={busy}
          onClose={() => setRefundOpen(false)}
          onConfirm={handleRecordRefund}
        />
      ) : null}
    </div>
  );
}
