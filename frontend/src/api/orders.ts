import { apiRequest } from "./client";
import type { Order, PaymentPayload } from "../types";

export type CreateOrderItem = {
  menuItemId: string;
  quantity: number;
  optionIds?: string[];
  sizeId?: string | null;
  preferences?: string;
};

export type CreateOrderBody = {
  items: CreateOrderItem[];
  payAtPickup?: boolean;
  payment?: PaymentPayload;
};

export function createOrder(body: CreateOrderBody) {
  return apiRequest<{ order: Order }>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function collectPayment(orderId: string, payment: PaymentPayload) {
  return apiRequest<{ order: Order }>(`/orders/${orderId}/collect-payment`, {
    method: "POST",
    body: JSON.stringify({ payment }),
  });
}

export function confirmOrderCash(orderId: string) {
  return apiRequest<{ order: Order }>(`/orders/${orderId}/confirm-cash`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function retryPayment(orderId: string, payment: PaymentPayload) {
  return apiRequest<{ order: Order }>(`/orders/${orderId}/retry-payment`, {
    method: "POST",
    body: JSON.stringify({ payment }),
  });
}

export function refundOrder(orderId: string) {
  return apiRequest<{ order: Order }>(`/orders/${orderId}/refund`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getKitchenFeed(includeVoided = false) {
  const query = includeVoided ? "?includeVoided=true" : "";
  return apiRequest<{ orders: Order[] }>(`/kitchen/feed${query}`);
}

export function getCashierFeed() {
  return apiRequest<{ orders: Order[] }>("/cashier/feed");
}

export function getActiveOrders(
  options?: string | { status?: string; needsPayment?: boolean },
) {
  const params = new URLSearchParams();
  if (typeof options === "string") {
    params.set("status", options);
  } else if (options) {
    if (options.status) params.set("status", options.status);
    if (options.needsPayment) params.set("needsPayment", "true");
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ orders: Order[] }>(`/orders/active${query}`);
}

export function voidCardPortion(orderId: string) {
  return apiRequest<{ order: Order }>(`/orders/${orderId}/void-card`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function startOrder(id: string) {
  return apiRequest<{ order: Order }>(`/orders/${id}/start`, {
    method: "PATCH",
  });
}

export function finishOrder(id: string) {
  return apiRequest<{ order: Order }>(`/orders/${id}/finish`, {
    method: "PATCH",
  });
}

export function completeOrder(id: string) {
  return apiRequest<{ order: Order }>(`/orders/${id}/complete`, {
    method: "PATCH",
  });
}

export function cancelOrder(id: string, reason?: string) {
  return apiRequest<{ order: Order }>(`/orders/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason: reason?.trim() || null }),
  });
}
