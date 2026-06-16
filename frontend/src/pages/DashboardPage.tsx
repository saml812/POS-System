import { useCallback, useEffect, useState } from "react";
import { getMenu } from "../api/menu";
import {
  archiveOrders,
  downloadOrderExport,
  getSalesSummary,
  type SalesSummary,
} from "../api/stats";
import { SalesCharts } from "../components/dashboard/SalesCharts";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import type { Locale } from "../i18n/translations";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { isManager } from "../lib/permissions";
import type { Role } from "../types";
import { formatMoney } from "../utils/order";

function defaultArchiveBeforeDate(businessDate: string) {
  const [year, month] = businessDate.split("-");
  return `${year}-${month}-01`;
}

function formatBusinessDate(date: string, locale: Locale) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function DashboardStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="em-stat dashboard-stat">
      <span className="em-stat-value">{value}</span>
      <span className="em-stat-label">{label}</span>
      {detail ? <span className="dashboard-stat-detail muted">{detail}</span> : null}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const manager = isManager(user);
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [archiveBeforeDate, setArchiveBeforeDate] = useState("");
  const [error, setError] = useState("");
  const { busy, success, run, setSuccess } = useAsyncAction(
    t("common.requestFailed"),
  );

  const loadSales = useCallback(async () => {
    const data = await getSalesSummary();
    setSales(data.summary);
    setArchiveBeforeDate((current) =>
      current || defaultArchiveBeforeDate(data.summary.businessDate),
    );
  }, []);

  useEffect(() => {
    Promise.all([
      getMenu().then((data) => {
        const itemCount = data.categories.reduce(
          (sum, category) => sum + category.items.length,
          0,
        );
        setMenuCount(itemCount);
      }),
      loadSales(),
    ]).catch((err: Error) => setError(err.message));
  }, [loadSales]);

  async function handleExport() {
    if (!archiveBeforeDate) return;

    await run(
      async () => {
        await downloadOrderExport(archiveBeforeDate);
      },
      { successMessage: t("dashboard.archiveExportSuccess") },
    );
  }

  async function handleArchive() {
    if (!archiveBeforeDate) return;

    const confirmed = window.confirm(
      t("dashboard.archiveConfirm", { date: archiveBeforeDate }),
    );
    if (!confirmed) return;

    await run(async () => {
      const result = await archiveOrders(archiveBeforeDate);
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      await loadSales();
      setSuccess(
        t("dashboard.archiveSuccess", { count: String(result.deletedCount) }),
      );
    });
  }

  return (
    <div className="page em-page dashboard-page">
      <header className="em-hero">
        <div className="em-hero-text">
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.welcome", { email: user?.email ?? "" })}</p>
          {sales ? (
            <p className="dashboard-hero-meta">
              {t("dashboard.salesSubtitle", {
                date: formatBusinessDate(sales.businessDate, locale),
              })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary ft-refresh-btn"
          onClick={() =>
            loadSales().catch((err: Error) => setError(err.message))
          }
        >
          {t("common.refresh")}
        </button>
      </header>

      <div className="dashboard-stats">
        <div className="dashboard-stats-row">
          <DashboardStat
            label={t("dashboard.role")}
            value={user ? t(`roles.${user.role as Role}`) : "—"}
          />
          <DashboardStat
            label={t("dashboard.menuItems")}
            value={menuCount === null ? "…" : String(menuCount)}
          />
        </div>
        <div className="dashboard-stats-row">
          <DashboardStat
            label={t("dashboard.dailySales")}
            value={formatMoney(sales?.daily.totalSales ?? 0)}
            detail={t("dashboard.orderCount", {
              count: String(sales?.daily.orderCount ?? 0),
            })}
          />
          <DashboardStat
            label={t("dashboard.monthlySales")}
            value={formatMoney(sales?.monthly.totalSales ?? 0)}
            detail={t("dashboard.orderCount", {
              count: String(sales?.monthly.orderCount ?? 0),
            })}
          />
        </div>
      </div>

      <SalesCharts
        daily={sales?.daily ?? null}
        monthly={sales?.monthly ?? null}
      />

      {manager ? (
        <section className="em-form-panel dashboard-archive">
          <h3>{t("dashboard.archiveTitle")}</h3>
          <p className="muted">{t("dashboard.archiveDesc")}</p>

          <div className="dashboard-archive-layout">
            <label className="em-field">
              <span className="em-field-label">{t("dashboard.archiveBefore")}</span>
              <input
                type="date"
                className="em-input"
                value={archiveBeforeDate}
                onChange={(event) => setArchiveBeforeDate(event.target.value)}
                disabled={busy}
              />
            </label>

            <div className="em-form-actions dashboard-archive-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || !archiveBeforeDate}
                onClick={() => handleExport().catch(() => undefined)}
              >
                {t("dashboard.archiveExport")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy || !archiveBeforeDate}
                onClick={() => handleArchive().catch(() => undefined)}
              >
                {busy
                  ? t("dashboard.archiveWorking")
                  : t("dashboard.archiveDelete")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {success ? <p className="success">{success}</p> : null}
      {error ? (
        <p className="error">{t("common.apiFailed", { message: error })}</p>
      ) : null}
    </div>
  );
}
