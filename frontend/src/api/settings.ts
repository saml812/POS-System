import { apiRequest } from "./client";

export type TicketResetSettings = {
  timezone: string | null;
  resetHour: number;
};

export type Settings = {
  ticketReset: TicketResetSettings;
  ticketStatus: {
    businessDate: string;
    lastTicketNumber: number;
  };
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
