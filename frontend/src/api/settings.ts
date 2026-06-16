import { apiRequest } from "./client";

export type TicketResetSettings = {
  timezone: string | null;
  resetHour: number;
};

export type ReceiptSettings = {
  printerType: string;
  printerIp: string | null;
  printerPort: number;
  storeName: string;
  configured: boolean;
};

export type Settings = {
  ticketReset: TicketResetSettings;
  ticketStatus: {
    businessDate: string;
    lastTicketNumber: number;
  };
  receipt: ReceiptSettings;
};

export function getSettings() {
  return apiRequest<{ settings: Settings }>("/settings");
}

export function updateTicketReset(data: {
  timezone?: string;
  resetHour?: number;
}) {
  return apiRequest<{ settings: Settings }>("/settings/ticket-reset", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateReceiptSettings(data: {
  printerType?: string;
  printerIp?: string;
  printerPort?: number;
  storeName?: string;
}) {
  return apiRequest<{ settings: Settings }>("/settings/receipt", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function testReceiptPrinter() {
  return apiRequest<{ ok: boolean; message?: string }>(
    "/settings/receipt/test",
    { method: "POST", body: JSON.stringify({}) },
  );
}
