import { useCallback, useEffect, useMemo, useState } from "react";
import { getMenu } from "../api/menu";
import {
  cancelOrder,
  collectPayment,
  confirmOrderCash,
  createOrder,
  getActiveOrders,
  refundOrder,
  retryPayment,
  voidCardPortion,
} from "../api/orders";
import { AddToCartModal, type CartItemDraft } from "../components/AddToCartModal";
import { CancelOrderForm } from "../components/CancelOrderForm";
import { OrderCard } from "../components/OrderCard";
import { CartPanel } from "../components/place-order/CartPanel";
import {
  CheckoutModal,
  type CheckoutStep,
} from "../components/place-order/CheckoutModal";
import { MenuItemCard } from "../components/place-order/MenuItemCard";
import {
  MobileCartBar,
  MobileCartDrawer,
} from "../components/place-order/MobileCartDrawer";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useCart, type ResolvedCartLine } from "../hooks/useCart";
import { useOrderSocket } from "../hooks/useOrderSocket";
import { canPlaceOrders, isManager } from "../lib/permissions";
import type { Category, MenuItem, Order, PaymentPayload } from "../types";
import {
  applyRefundableOrderEvent,
  applyStaffOrderEvent,
  canRefundOrder,
  isSplitAwaitingCash,
  mergeOrderLists,
  needsCollectPayment,
  orderTotal,
} from "../utils/order";

type MenuCategory = Category & { items: MenuItem[] };

type CartModalState =
  | { mode: "add"; item: MenuItem }
  | { mode: "edit"; item: MenuItem; lineKey: string; initial: CartItemDraft }
  | null;

export function PlaceOrderPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canPlace = canPlaceOrders(user);
  const manager = isManager(user);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [cartModal, setCartModal] = useState<CartModalState>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [staffOrders, setStaffOrders] = useState<Order[]>([]);
  const [refundableOrders, setRefundableOrders] = useState<Order[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"place" | "collect">("place");
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("payment");
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);

  const menuItems = useMemo(
    () => categories.flatMap((category) => category.items),
    [categories],
  );

  const cart = useCart(menuItems);
  const { error, success, busy, run, setSuccess } = useAsyncAction(
    t("placeOrder.failed"),
  );

  const loadOrderLists = useCallback(async () => {
    if (!canPlace) return;

    const [unpaidData, pendingData, completedData] = await Promise.all([
      getActiveOrders({ needsPayment: true }),
      getActiveOrders({ status: "PENDING" }),
      manager ? getActiveOrders({ status: "COMPLETED" }) : Promise.resolve({ orders: [] }),
    ]);

    setStaffOrders(
      mergeOrderLists([...unpaidData.orders, ...pendingData.orders]),
    );

    if (manager) {
      setRefundableOrders(
        completedData.orders.filter((order) => canRefundOrder(order)),
      );
    }
  }, [canPlace, manager]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getMenu()
      .then((data) => {
        if (!active) return;
        setCategories(data.categories);
        if (data.categories[0]) {
          setActiveCategory(data.categories[0].id);
        }
      })
      .catch((err: Error) => {
        if (active) setLoadError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadOrderLists().catch(() => undefined);
  }, [loadOrderLists]);

  useOrderSocket({
    enabled: canPlace,
    onOrder: (_event, order) => {
      setStaffOrders((current) => applyStaffOrderEvent(current, order));
      if (manager) {
        setRefundableOrders((current) =>
          applyRefundableOrderEvent(current, order),
        );
      }
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

  function openAddModal(item: MenuItem) {
    setCartModal({ mode: "add", item });
  }

  function openEditModal(line: ResolvedCartLine) {
    setCartModal({
      mode: "edit",
      item: line.item,
      lineKey: line.key,
      initial: {
        optionIds: line.optionIds,
        sizeId: line.sizeId,
        preferences: line.preferences,
        quantity: line.quantity,
      },
    });
  }

  function closeCartModal() {
    setCartModal(null);
  }

  const cartItemsPayload = () =>
    cart.lines.map(
      ({ menuItemId, optionIds, sizeId, preferences, quantity }) => ({
        menuItemId,
        optionIds,
        sizeId,
        preferences,
        quantity,
      }),
    );

  function closeCheckout() {
    if (busy) return;
    setCheckoutOpen(false);
    setCheckoutOrder(null);
    setCheckoutStep("payment");
    setCheckoutMode("place");
  }

  function openPlaceCheckout() {
    if (cart.lines.length === 0) return;
    setCheckoutMode("place");
    setCheckoutStep("payment");
    setCheckoutOrder(null);
    setCheckoutOpen(true);
  }

  function openOrderCheckout(order: Order) {
    setCheckoutMode("collect");
    setCheckoutOrder(order);
    setCheckoutStep(isSplitAwaitingCash(order) ? "split-cash" : "payment");
    setCheckoutOpen(true);
  }

  async function handleCancelPending(orderId: string, reason?: string) {
    await run(
      () => cancelOrder(orderId, reason),
      {
        successMessage: t("placeOrder.pendingCancelled"),
        onAfter: async () => {
          setCancellingId(null);
          await loadOrderLists();
        },
      },
    );
  }

  async function handlePlaceWalkIn(payment: PaymentPayload) {
    await run(async () => {
      const { order } = await createOrder({
        items: cartItemsPayload(),
        payment,
      });

      if (isSplitAwaitingCash(order)) {
        setCheckoutOrder(order);
        setCheckoutStep("split-cash");
        setCheckoutMode("place");
        setCheckoutOpen(true);
      } else {
        closeCheckout();
        cart.clear();
        setSuccess(
          t("placeOrder.paidSent", { num: order.ticketNumber }),
        );
      }

      await loadOrderLists();
    });
  }

  async function handlePlaceCallIn() {
    await run(
      async () => {
        await createOrder({
          items: cartItemsPayload(),
          payAtPickup: true,
        });
        closeCheckout();
        cart.clear();
        await loadOrderLists();
      },
      { successMessage: t("placeOrder.callInSent") },
    );
  }

  async function handleCollect(payment: PaymentPayload) {
    if (!checkoutOrder) return;

    await run(async () => {
      const action =
        checkoutOrder.paymentStatus === "FAILED" ? retryPayment : collectPayment;
      const { order } = await action(checkoutOrder.id, payment);

      if (isSplitAwaitingCash(order)) {
        setCheckoutOrder(order);
        setCheckoutStep("split-cash");
      } else {
        closeCheckout();
        setSuccess(t("payment.collected"));
      }

      await loadOrderLists();
    });
  }

  async function handleConfirmSplitCash() {
    const orderId = checkoutOrder?.id;
    if (!orderId) return;

    await run(async () => {
      const { order } = await confirmOrderCash(orderId);
      closeCheckout();
      cart.clear();

      if (checkoutMode === "place") {
        setSuccess(
          t("placeOrder.paidSent", { num: order.ticketNumber }),
        );
      } else {
        setSuccess(t("payment.collected"));
      }

      await loadOrderLists();
    });
  }

  async function handleVoidCard() {
    const orderId = checkoutOrder?.id;
    if (!orderId) return;

    await run(
      async () => {
        await voidCardPortion(orderId);
        closeCheckout();
        await loadOrderLists();
      },
      { successMessage: t("payment.voidCardSuccess") },
    );
  }

  async function handleRefund(orderId: string) {
    await run(
      () => refundOrder(orderId),
      {
        successMessage: t("payment.refundSuccess"),
        onAfter: loadOrderLists,
      },
    );
  }

  const checkoutTotal =
    checkoutMode === "place" || !checkoutOrder
      ? cart.total
      : orderTotal(checkoutOrder);

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
                        onAdd={() => openAddModal(item)}
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
            onEdit={openEditModal}
            onRemove={cart.remove}
            onCheckout={openPlaceCheckout}
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
        onEdit={openEditModal}
        onRemove={cart.remove}
        onCheckout={openPlaceCheckout}
      />

      {cartModal && (
        <AddToCartModal
          key={
            cartModal.mode === "edit"
              ? `edit-${cartModal.lineKey}`
              : `add-${cartModal.item.id}`
          }
          item={cartModal.item}
          mode={cartModal.mode}
          initial={cartModal.mode === "edit" ? cartModal.initial : undefined}
          onConfirm={(optionIds, sizeId, preferences, quantity) => {
            if (cartModal.mode === "edit") {
              cart.updateLine(cartModal.lineKey, {
                optionIds,
                sizeId,
                preferences,
                quantity,
              });
            } else {
              cart.add(
                cartModal.item.id,
                optionIds,
                sizeId,
                preferences,
                quantity,
              );
            }
            closeCartModal();
          }}
          onClose={closeCartModal}
        />
      )}

      <CheckoutModal
        open={checkoutOpen}
        total={checkoutTotal}
        ticketNumber={checkoutOrder?.ticketNumber}
        mode={checkoutMode}
        step={checkoutStep}
        splitCardAmount={checkoutOrder?.cardAmount ?? 0}
        splitCashAmount={checkoutOrder?.cashAmount ?? 0}
        busy={busy}
        onClose={closeCheckout}
        onPlaceWalkIn={handlePlaceWalkIn}
        onPlaceCallIn={handlePlaceCallIn}
        onCollect={handleCollect}
        onConfirmSplitCash={handleConfirmSplitCash}
        onVoidCard={
          checkoutStep === "split-cash" && checkoutOrder ? handleVoidCard : undefined
        }
      />

      {canPlace && staffOrders.length > 0 && (
        <section className="dd-secondary-section">
          <h3>{t("placeOrder.activeOrdersTitle")}</h3>
          <p className="muted">{t("placeOrder.activeOrdersDesc")}</p>
          <div className="order-feed">
            {staffOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <div className="ft-ticket-action-row">
                    {needsCollectPayment(order) ? (
                      <button
                        type="button"
                        className="btn btn-brand btn-small"
                        disabled={busy}
                        onClick={() => openOrderCheckout(order)}
                      >
                        {order.paymentStatus === "FAILED"
                          ? t("payment.retry")
                          : isSplitAwaitingCash(order)
                            ? t("payment.confirmCash")
                            : t("payment.collect")}
                      </button>
                    ) : null}
                    {isSplitAwaitingCash(order) ? (
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => voidCardPortion(order.id),
                            {
                              successMessage: t("payment.voidCardSuccess"),
                              onAfter: loadOrderLists,
                            },
                          )
                        }
                      >
                        {t("payment.voidCard")}
                      </button>
                    ) : null}
                    {order.status === "PENDING" ? (
                      cancellingId === order.id ? (
                        <CancelOrderForm
                          busy={busy}
                          onConfirm={(reason) =>
                            handleCancelPending(order.id, reason)
                          }
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
                    ) : null}
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {manager && refundableOrders.length > 0 && (
        <section className="dd-secondary-section">
          <h3>{t("placeOrder.refundTitle")}</h3>
          <p className="muted">{t("placeOrder.refundDesc")}</p>
          <div className="order-feed">
            {refundableOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={busy}
                    onClick={() => handleRefund(order.id)}
                  >
                    {t("payment.refund")}
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
