import { appError } from "../lib/appError.js";
import {
  getPublicSettings,
  updateTicketResetSettings,
} from "../lib/tickets.js";

async function withAppError(action) {
  try {
    return await action();
  } catch (err) {
    throw appError(err.message);
  }
}

export function getSettings() {
  return getPublicSettings();
}

export async function updateTicketReset(input) {
  await withAppError(() => updateTicketResetSettings(input));
  return getPublicSettings();
}
