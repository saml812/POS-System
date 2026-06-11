import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import type { Role } from "../types";
import { LanguageSwitcher } from "./LanguageSwitcher";

const navItems: {
  to: string;
  key: string;
  roles?: Role[];
}[] = [
  { to: "/dashboard", key: "nav.dashboard" },
  { to: "/place-order", key: "nav.placeOrder" },
  { to: "/edit-menu", key: "nav.editMenu" },
  { to: "/kitchen-feed", key: "nav.kitchenFeed" },
  { to: "/cashier-feed", key: "nav.cashierFeed" },
  { to: "/settings", key: "nav.settings", roles: ["MANAGER"] },
];

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useLocale();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>{t("app.title")}</h1>
        {user && (
          <p className="sidebar-user">
            {user.email}
            <span className="role-badge">
              {t(`roles.${user.role as Role}`)}
            </span>
          </p>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems
          .filter((item) => {
            if (!item.roles?.length) return true;
            return user ? item.roles.includes(user.role) : false;
          })
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-footer">
        <LanguageSwitcher compact />
        <button
          type="button"
          className="btn btn-secondary logout-btn"
          onClick={() => logout()}
        >
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
