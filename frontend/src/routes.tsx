import { Navigate, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CashierFeedPage } from "./pages/CashierFeedPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EditMenuPage } from "./pages/EditMenuPage";
import { KitchenFeedPage } from "./pages/KitchenFeedPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceOrderPage } from "./pages/PlaceOrderPage";
import { RefundsPage } from "./pages/RefundsPage";
import { SettingsPage } from "./pages/SettingsPage";

export const appRoutes = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/place-order" element={<PlaceOrderPage />} />
        <Route path="/edit-menu" element={<EditMenuPage />} />
        <Route path="/kitchen-feed" element={<KitchenFeedPage />} />
        <Route path="/cashier-feed" element={<CashierFeedPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </>
);
