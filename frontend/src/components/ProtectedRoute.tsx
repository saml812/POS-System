import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="page-center">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
