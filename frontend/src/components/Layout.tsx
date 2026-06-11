import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useLocale } from "../context/LocaleContext";
import { Sidebar } from "./Sidebar";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useLocale();

  return (
    <div className={`app-layout ${sidebarOpen ? "sidebar-open" : ""}`}>
      <button
        type="button"
        className="sidebar-toggle"
        aria-label={t("nav.menu")}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t("common.close")}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar onNavigate={() => setSidebarOpen(false)} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
