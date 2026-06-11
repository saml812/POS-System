import { useEffect, useState } from "react";
import { getMenu } from "../api/menu";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import type { Role } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMenu()
      .then((data) => {
        const itemCount = data.categories.reduce(
          (sum, category) => sum + category.items.length,
          0,
        );
        setMenuCount(itemCount);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h2>{t("dashboard.title")}</h2>
        <p className="muted">
          {t("dashboard.welcome", { email: user?.email ?? "" })}
        </p>
      </header>

      <div className="card-grid">
        <div className="card stat-card">
          <span className="stat-label">{t("dashboard.role")}</span>
          <span className="stat-value">
            {user ? t(`roles.${user.role as Role}`) : "—"}
          </span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">{t("dashboard.menuItems")}</span>
          <span className="stat-value">
            {menuCount === null ? "..." : menuCount}
          </span>
        </div>
      </div>

      {error && (
        <p className="error">{t("common.apiFailed", { message: error })}</p>
      )}
    </div>
  );
}
