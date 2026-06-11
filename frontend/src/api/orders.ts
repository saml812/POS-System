import { apiRequest } from "./client";
import type { Order } from "../types";

export function createOrder(
  items: {
    menuItemId: string;
    quantity: number;
    optionIds?: string[];
    sizeId?: string | null;
    preferences?: string;
  }[],
) {
  return apiRequest<{ order: Order }>("/orders", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function getKitchenFeed(includeVoided = false) {
  const query = includeVoided ? "?includeVoided=true" : "";
  return apiRequest<{ orders: Order[] }>(`/kitchen/feed${query}`);
}

export function getCashierFeed() {
  return apiRequest<{ orders: Order[] }>("/cashier/feed");
}

export function getActiveOrders(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
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
