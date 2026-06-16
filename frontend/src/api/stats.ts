import { apiRequest } from "./client";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export type SalesTotals = {
  totalSales: number;
  cardAmount: number;
  cashAmount: number;
  orderCount: number;
};

export type SalesSummary = {
  businessDate: string;
  month: string;
  daily: SalesTotals;
  monthly: SalesTotals;
};

export function getSalesSummary() {
  return apiRequest<{ summary: SalesSummary }>("/stats/sales");
}

export async function downloadOrderExport(beforeDate: string) {
  const response = await fetch(
    `${API_BASE}/stats/export?before=${encodeURIComponent(beforeDate)}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/)?.[1] ??
    `pos-orders-before-${beforeDate}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function archiveOrders(beforeDate: string) {
  return apiRequest<{
    ok: boolean;
    beforeDate: string;
    orderCount: number;
    deletedCount: number;
    filename: string;
    csv: string;
  }>("/stats/archive", {
    method: "POST",
    body: JSON.stringify({ beforeDate }),
  });
}
