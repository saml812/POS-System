import { appError } from "../lib/appError.js";
import { withTerminalLock } from "../lib/terminalMutex.js";
import {
  getPublicSettings,
  updateTicketResetSettings,
} from "../lib/tickets.js";
import {
  refreshPaymentConfig,
  toPublicPaymentSettings,
  updatePaymentSettings,
} from "../lib/paymentConfig.js";
import * as datacap from "../services/datacap.service.js";
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
  await refreshPaymentConfig();
  const ticket = await getPublicSettings();

  return {
    ...ticket,
    payment: toPublicPaymentSettings(),
  };
}

export async function updateTicketReset(input) {
  await withAppError(() => updateTicketResetSettings(input));
  return getSettings();
}

export async function updatePayment(input) {
  await withAppError(() => updatePaymentSettings(input));
  return getSettings();
}

export async function testTerminal() {
  return withAppError(() => datacap.testTerminalConnection());
}

export async function testReceiptPrinter() {
  return withAppError(() =>
    withTerminalLock(() => printTestReceipt()),
  );
}
