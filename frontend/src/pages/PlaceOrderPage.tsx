import { useCallback, useEffect, useMemo, useState } from "react";
import { getMenu } from "../api/menu";
import { cancelOrder, createOrder, getActiveOrders } from "../api/orders";
import { AddToCartModal } from "../components/AddToCartModal";
import { CancelOrderForm } from "../components/CancelOrderForm";
import { OrderCard } from "../components/OrderCard";
import { CartPanel } from "../components/place-order/CartPanel";
import { MenuItemCard } from "../components/place-order/MenuItemCard";
import {
  MobileCartBar,
  MobileCartDrawer,
} from "../components/place-order/MobileCartDrawer";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useCart } from "../hooks/useCart";
import { useOrderSocket } from "../hooks/useOrderSocket";
import { canPlaceOrders } from "../lib/permissions";
import type { Category, MenuItem, Order } from "../types";
import { applyPendingOrderEvent } from "../utils/order";

type MenuCategory = Category & { items: MenuItem[] };

export function PlaceOrderPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canPlace = canPlaceOrders(user);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const menuItems = useMemo(
    () => categories.flatMap((category) => category.items),
    [categories],
  );

  const cart = useCart(menuItems);
  const { error, success, busy, run } = useAsyncAction(t("placeOrder.failed"));

  const loadPendingOrders = useCallback(async () => {
    if (!canPlace) return;
    const data = await getActiveOrders("PENDING");
    setPendingOrders(data.orders);
  }, [canPlace]);

  useEffect(() => {
    setLoading(true);
    getMenu()
      .then((data) => {
        setCategories(data.categories);
        if (data.categories[0]) {
          setActiveCategory(data.categories[0].id);
        }
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPendingOrders().catch(() => undefined);
  }, [loadPendingOrders]);

  useOrderSocket({
    enabled: canPlace,
    onOrder: (_event, order) => {
      setPendingOrders((current) => applyPendingOrderEvent(current, order));
    },
  });

  const query = search.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!query) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.itemNumber?.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, query]);

  const activeCategoryData = useMemo(
    () =>
      filteredCategories.find((category) => category.id === activeCategory) ??
      filteredCategories[0] ??
      null,
    [filteredCategories, activeCategory],
  );

  useEffect(() => {
    if (filteredCategories.length === 0) return;
    if (!filteredCategories.some((category) => category.id === activeCategory)) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategory]);

  async function handleCancelPending(orderId: string, reason?: string) {
    await run(
      () => cancelOrder(orderId, reason),
      {
        successMessage: t("placeOrder.pendingCancelled"),
        onAfter: async () => {
          setCancellingId(null);
          await loadPendingOrders();
        },
      },
    );
  }

  async function handlePlaceOrder() {
    if (cart.lines.length === 0) return;

    await run(
      () =>
        createOrder(
          cart.lines.map(
            ({ menuItemId, optionIds, sizeId, preferences, quantity }) => ({
              menuItemId,
              optionIds,
              sizeId,
              preferences,
              quantity,
            }),
          ),
        ),
      {
        successMessage: t("placeOrder.sent"),
        onAfter: async () => {
          cart.clear();
          await loadPendingOrders();
        },
      },
    );
  }

  const displayError = loadError || error;

  return (
    <div className="page place-order-page">
      <header className="dd-hero">
        <div className="dd-hero-content">
          <h1>{t("placeOrder.title")}</h1>
          <p>{t("placeOrder.subtitle")}</p>
        </div>
        <div className="dd-search-wrap">
          <span className="dd-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="dd-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("placeOrder.searchPlaceholder")}
          />
        </div>
      </header>

      {!canPlace && (
        <Banner variant="warning">{t("placeOrder.roleWarning")}</Banner>
      )}

      {loading && <p className="dd-loading">{t("placeOrder.loadingMenu")}</p>}
      {displayError && <Banner variant="error">{displayError}</Banner>}
      {success && <Banner variant="success">{success}</Banner>}

      {!loading && filteredCategories.length > 0 && (
        <nav className="dd-category-nav" aria-label={t("placeOrder.categories")}>
          {filteredCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`dd-category-pill ${activeCategory === category.id ? "active" : ""}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>
      )}

      {!loading && (
        <div className="dd-layout">
          <div className="dd-menu">
            {filteredCategories.length === 0 ? (
              <div className="dd-empty-search">
                <p>{t("placeOrder.noResults")}</p>
              </div>
            ) : activeCategoryData ? (
              <section
                key={activeCategoryData.id}
                className="dd-category-section"
                aria-live="polite"
              >
                <h2 className="dd-category-title">{activeCategoryData.name}</h2>
                {activeCategoryData.items.length === 0 ? (
                  <div className="dd-empty-search">
                    <p>{t("placeOrder.noResults")}</p>
                  </div>
                ) : (
                  <div className="dd-item-list">
                    {activeCategoryData.items.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        categoryId={activeCategoryData.id}
                        canAdd={canPlace}
                        onAdd={() => setPickerItem(item)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>

          <CartPanel
            className="dd-cart-desktop"
            lines={cart.lines}
            total={cart.total}
            canPlace={canPlace}
            submitting={busy}
            onChangeQuantity={cart.changeQuantity}
            onRemove={cart.remove}
            onCheckout={handlePlaceOrder}
          />
        </div>
      )}

      {canPlace && cart.itemCount > 0 && (
        <MobileCartBar
          itemCount={cart.itemCount}
          total={cart.total}
          onOpen={() => cart.setOpen(true)}
        />
      )}

      <MobileCartDrawer
        lines={cart.lines}
        total={cart.total}
        canPlace={canPlace}
        submitting={busy}
        open={cart.open}
        onClose={() => cart.setOpen(false)}
        onChangeQuantity={cart.changeQuantity}
        onRemove={cart.remove}
        onCheckout={handlePlaceOrder}
      />

      {pickerItem && (
        <AddToCartModal
          key={pickerItem.id}
          item={pickerItem}
          onAdd={(optionIds, sizeId, preferences) => {
            cart.add(pickerItem.id, optionIds, sizeId, preferences);
            setPickerItem(null);
          }}
          onClose={() => setPickerItem(null)}
        />
      )}

      {canPlace && pendingOrders.length > 0 && (
        <section className="dd-secondary-section">
          <h3>{t("placeOrder.pendingTitle")}</h3>
          <p className="muted">{t("placeOrder.pendingDesc")}</p>
          <div className="order-feed">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  cancellingId === order.id ? (
                    <CancelOrderForm
                      busy={busy}
                      onConfirm={(reason) => handleCancelPending(order.id, reason)}
                      onDismiss={() => setCancellingId(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      disabled={busy}
                      onClick={() => setCancellingId(order.id)}
                    >
                      {t("order.cancel.order")}
                    </button>
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
