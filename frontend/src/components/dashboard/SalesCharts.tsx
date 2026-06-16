import type { SalesTotals } from "../../api/stats";
import { useLocale } from "../../context/LocaleContext";
import { formatMoney } from "../../utils/order";
import { DonutChart } from "./DonutChart";

const CHART_COLORS = {
  card: "#4338ca",
  cash: "#059669",
};

type SalesChartsProps = {
  daily: SalesTotals | null;
  monthly: SalesTotals | null;
};

export function SalesCharts({ daily, monthly }: SalesChartsProps) {
  const { t } = useLocale();

  const dailySegments = [
    {
      id: "card",
      label: t("checkout.tenders.CARD"),
      value: daily?.cardAmount ?? 0,
      color: CHART_COLORS.card,
    },
    {
      id: "cash",
      label: t("checkout.tenders.CASH"),
      value: daily?.cashAmount ?? 0,
      color: CHART_COLORS.cash,
    },
  ];

  const monthlySegments = [
    {
      id: "card",
      label: t("checkout.tenders.CARD"),
      value: monthly?.cardAmount ?? 0,
      color: CHART_COLORS.card,
    },
    {
      id: "cash",
      label: t("checkout.tenders.CASH"),
      value: monthly?.cashAmount ?? 0,
      color: CHART_COLORS.cash,
    },
  ];

  return (
    <section className="dashboard-sales">
      <div className="dashboard-chart-grid">
        <article className="card dashboard-chart-card">
          <header className="dashboard-chart-head">
            <h3>{t("dashboard.chartDailyMix")}</h3>
            <p className="muted">{t("dashboard.chartHint")}</p>
          </header>
          <DonutChart
            segments={dailySegments}
            totalLabel={formatMoney(daily?.totalSales ?? 0)}
            emptyLabel={t("dashboard.noSales")}
            hintLabel={t("dashboard.chartTotal")}
          />
        </article>

        <article className="card dashboard-chart-card">
          <header className="dashboard-chart-head">
            <h3>{t("dashboard.chartMonthlyMix")}</h3>
            <p className="muted">{t("dashboard.chartHint")}</p>
          </header>
          <DonutChart
            segments={monthlySegments}
            totalLabel={formatMoney(monthly?.totalSales ?? 0)}
            emptyLabel={t("dashboard.noSales")}
            hintLabel={t("dashboard.chartTotal")}
          />
        </article>
      </div>
    </section>
  );
}
