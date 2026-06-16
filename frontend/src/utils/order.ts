import type { Locale } from "../i18n/translations";
import type { MenuItemOption, Order, OrderItemOption, OrderStatus } from "../types";

export function orderStatusLabel(
  status: OrderStatus,
  t: (key: string) => string,
) {
  return t(`order.status.${status}`);
}

export function orderTotal(order: Order) {
  return order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
}

export function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function formatPriceDelta(priceDelta: number) {
  if (priceDelta <= 0) return "";
  return `+${formatMoney(priceDelta)}`;
}

export function formatTime(iso: string, locale: Locale = "en") {
  return new Date(iso).toLocaleTimeString(
    locale === "zh" ? "zh-CN" : "en-US",
    { hour: "2-digit", minute: "2-digit" },
  );
}

export function lineUnitPrice(
  basePrice: number,
  options: Pick<MenuItemOption | OrderItemOption, "priceDelta">[],
) {
  return (
    basePrice +
    options.reduce((sum, option) => sum + option.priceDelta, 0)
  );
}

export function cartLineKey(
  menuItemId: string,
  optionIds: string[],
  sizeId?: string | null,
  preferences?: string,
) {
  const prefs = preferences?.trim() || "";
  return `${menuItemId}:${sizeId ?? ""}:${[...optionIds].sort().join(",")}:${prefs}`;
}

export function formatItemLabel(
  name: string,
  itemCode?: string | null,
  quantity?: number,
) {
  const codePrefix = itemCode ? `${itemCode} ` : "";
  const qtyPrefix =
    quantity !== undefined && quantity > 1 ? `${quantity}x ` : "";
  return `${qtyPrefix}${codePrefix}${name}`.trim();
}

export function formatOptionNames(
  options: Pick<MenuItemOption | OrderItemOption, "name">[],
) {
  if (options.length === 0) return "";
  return options.map((option) => option.name).join(", ");
}

export function sortOrdersByTicket(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) =>
      a.ticketNumber - b.ticketNumber ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function upsertOrder(orders: Order[], order: Order): Order[] {
  const index = orders.findIndex((row) => row.id === order.id);
  if (index === -1) {
    return sortOrdersByTicket([...orders, order]);
  }

  const next = [...orders];
  next[index] = order;
  return sortOrdersByTicket(next);
}

export function removeOrder(orders: Order[], orderId: string): Order[] {
  return orders.filter((order) => order.id !== orderId);
}

export function isKitchenOrderVisible(
  order: Order,
  includeVoided: boolean,
): boolean {
  if (order.status === "CANCELLED") {
    return includeVoided;
  }

  return ["PENDING", "IN_PROGRESS", "FINISHED"].includes(order.status);
}

export function applyKitchenOrderEvent(
  orders: Order[],
  order: Order,
  includeVoided: boolean,
): Order[] {
  if (!isKitchenOrderVisible(order, includeVoided)) {
    return removeOrder(orders, order.id);
  }

  return upsertOrder(orders, order);
}

export function applyCashierOrderEvent(orders: Order[], order: Order): Order[] {
  if (order.status !== "FINISHED") {
    return removeOrder(orders, order.id);
  }

  return upsertOrder(orders, order);
}

export function isOrderPaid(order: Order) {
  return order.paidStatus === "PAID";
}

export function needsConfirmPaid(order: Order) {
  return order.payAtPickup && order.paidStatus === "UNPAID";
}

export function canRecordRefund(order: Order) {
  return order.status === "COMPLETED" && order.paidStatus === "PAID";
}

export function mergeOrderLists(orders: Order[]): Order[] {
  const map = new Map<string, Order>();
  for (const order of orders) {
    map.set(order.id, order);
  }
  return sortOrdersByTicket([...map.values()]);
}

export function applyStaffOrderEvent(orders: Order[], order: Order): Order[] {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return removeOrder(orders, order.id);
  }

  if (order.status === "PENDING" || needsConfirmPaid(order)) {
    return upsertOrder(orders, order);
  }

  return removeOrder(orders, order.id);
}

export function paidStatusLabel(
  order: Order,
  t: (key: string, vars?: Record<string, string>) => string,
) {
  if (order.payAtPickup && order.paidStatus === "UNPAID") {
    return t("checkout.badges.callInUnpaid");
  }
  if (order.paidStatus === "PAID" && order.tenderType) {
    return t(`checkout.tenders.${order.tenderType}`);
  }
  if (order.paidStatus === "REFUNDED" && order.refundTenderType) {
    return t(`checkout.tenders.${order.refundTenderType}`);
  }
  return t(`checkout.status.${order.paidStatus}`);
}
