import { appError } from "../lib/appError.js";
import {
  getPublicSettings,
  updateTicketResetSettings,
} from "../lib/tickets.js";
import {
  refreshReceiptConfig,
  toPublicReceiptSettings,
  updateReceiptSettings,
} from "../lib/receiptConfig.js";
import { printTestReceipt } from "../services/receipt.service.js";

async function withAppError(action) {
  try {
    return await action();
  } catch (err) {
    if (err.statusCode) throw err;
    throw appError(err.message);
  }
}

export async function getSettings() {
  await refreshReceiptConfig();
  const ticket = await getPublicSettings();

  return {
    ...ticket,
    receipt: toPublicReceiptSettings(),
  };
}

export async function updateTicketReset(input) {
  await withAppError(() => updateTicketResetSettings(input));
  return getSettings();
}

export async function updateReceipt(input) {
  await withAppError(() => updateReceiptSettings(input));
  return getSettings();
}

export async function testReceiptPrinter() {
  return withAppError(() => printTestReceipt());
}
