import { apiRequest } from "./client";
import type { Order, TenderPayload } from "../types";

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
  tender?: TenderPayload;
};

export function createOrder(body: CreateOrderBody) {
  return apiRequest<{ order: Order }>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function confirmPaid(orderId: string, tender: TenderPayload) {
  return apiRequest<{ order: Order }>(`/orders/${orderId}/confirm-paid`, {
    method: "POST",
    body: JSON.stringify({ tender }),
  });
}

export function reprintReceipt(orderId: string) {
  return apiRequest<{ printed: boolean; order: Order }>(
    `/orders/${orderId}/reprint-receipt`,
    { method: "POST", body: JSON.stringify({}) },
  );
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
  options?: { status?: string; awaitingPaid?: boolean },
) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.awaitingPaid) params.set("awaitingPaid", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ orders: Order[] }>(`/orders/active${query}`);
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
