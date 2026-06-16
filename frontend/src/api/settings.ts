import { apiRequest } from "./client";

export type TicketResetSettings = {
  timezone: string | null;
  resetHour: number;
};

export type PaymentTerminalSettings = {
  ip: string | null;
  port: number;
  merchantId: string | null;
  operationMode: string;
  configured: boolean;
};

export type PaymentReceiptSettings = {
  printerType: string;
  printerIp: string | null;
  printerPort: number;
  storeName: string;
  configured: boolean;
};

export type PaymentSettings = {
  terminal: PaymentTerminalSettings;
  receipt: PaymentReceiptSettings;
};

export type Settings = {
  ticketReset: TicketResetSettings;
  ticketStatus: {
    businessDate: string;
    lastTicketNumber: number;
  };
  payment: PaymentSettings;
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

export function updatePaymentSettings(data: {
  terminalIp?: string;
  terminalPort?: number;
  merchantId?: string;
  operationMode?: string;
  printerType?: string;
  printerIp?: string;
  printerPort?: number;
  storeName?: string;
}) {
  return apiRequest<{ settings: Settings }>("/settings/payment", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function testPaymentTerminal() {
  return apiRequest<{ ok: boolean; message?: string }>(
    "/settings/payment/test-terminal",
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function testReceiptPrinter() {
  return apiRequest<{ ok: boolean; message?: string }>(
    "/settings/payment/test-receipt",
    { method: "POST", body: JSON.stringify({}) },
  );
}
