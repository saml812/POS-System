import { getPaymentConfig } from "../lib/paymentConfig.js";
import { appError } from "../lib/appError.js";
import * as datacap from "./datacap.service.js";

const RECEIPT_WIDTH = 40;
const MAX_LINES = 80;

function money(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function center(text, width = RECEIPT_WIDTH) {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text;
}

function padLine(left, right, width = RECEIPT_WIDTH) {
  const spaces = width - left.length - right.length;
  if (spaces < 1) return truncate(`${left} ${right}`, width);
  return `${left}${" ".repeat(spaces)}${right}`;
}

function isTerminalConfigured(config) {
  return Boolean(config.terminalIp && config.merchantId);
}

export function buildOrderReceiptLines(order, config = getPaymentConfig()) {
  const lines = [];
  const storeName = config.storeName || "POS";

  lines.push(center(storeName));
  lines.push(center(`Ticket #${order.ticketNumber}`));
  lines.push("");
  lines.push("-".repeat(RECEIPT_WIDTH));

  for (const item of order.items ?? []) {
    const label = item.itemCode
      ? `${item.quantity}x ${item.itemCode} ${item.name}`
      : `${item.quantity}x ${item.name}`;
    lines.push(truncate(label, RECEIPT_WIDTH));

    if (item.sizeName) {
      lines.push(`  ${truncate(item.sizeName, RECEIPT_WIDTH - 2)}`);
    }

    const itemOptions = item.options ?? [];
    if (itemOptions.length > 0) {
      const optionNames = itemOptions.map((option) => option.name).join(", ");
      lines.push(`  ${truncate(optionNames, RECEIPT_WIDTH - 2)}`);
    }

    if (item.preferences?.trim()) {
      lines.push(`  ${truncate(item.preferences.trim(), RECEIPT_WIDTH - 2)}`);
    }

    const lineTotal = Number(item.price) * item.quantity;
    lines.push(padLine("", money(lineTotal)));
  }

  const total = (order.items ?? []).reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  lines.push("-".repeat(RECEIPT_WIDTH));
  lines.push(padLine("Total", money(total)));

  if (order.paymentMethod === "CASH") {
    lines.push("Paid: CASH");
  } else if (order.paymentMethod === "CARD") {
    lines.push("Paid: CARD");
  } else if (order.paymentMethod === "SPLIT") {
    lines.push(`Card: ${money(order.cardAmount ?? 0)}`);
    lines.push(`Cash: ${money(order.cashAmount ?? 0)}`);
  }

  lines.push("");
  lines.push(center("Thank you!"));

  return lines.slice(0, MAX_LINES);
}

export async function printCustomerReceipt(order) {
  const config = getPaymentConfig();

  if (!isTerminalConfigured(config)) {
    console.info(
      "[receipt] skipped (terminal not configured) ticket=%s",
      order.ticketNumber,
    );
    return { printed: false, skipped: true };
  }

  const lines = buildOrderReceiptLines(order, config);
  await datacap.runPrintReceipt({
    lines,
    ticketNumber: order.ticketNumber,
  });

  return { printed: true };
}

export async function printTestReceipt() {
  const config = getPaymentConfig();

  if (!isTerminalConfigured(config)) {
    throw appError("Payment terminal is not configured", 400);
  }

  const lines = [
    center(config.storeName || "POS"),
    "",
    center("Test receipt"),
    "",
    center("Terminal print OK"),
    "",
    center("Thank you!"),
  ];

  await datacap.runPrintReceipt({ lines, ticketNumber: "TEST" });
  return { printed: true };
}
