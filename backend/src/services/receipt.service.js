import net from "node:net";
import { SerialPort } from "serialport";
import {
  getReceiptConfig,
  isReceiptConfigured,
} from "../lib/receiptConfig.js";
import { sendRawToWindowsPrinter } from "../lib/windowsRawPrinter.js";
import { appError } from "../lib/appError.js";

const ESC = "\x1b";
const GS = "\x1d";
const INIT = ESC + "@";
const CUT = GS + "V\x00";
const LF = "\n";
const PRINTER_TIMEOUT_MS = 5000;
const RECEIPT_WIDTH = 32;

function money(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function upper(text) {
  return String(text ?? "").toUpperCase();
}

function truncate(text, max) {
  const value = String(text ?? "");
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function line(text = "") {
  return `${text}${LF}`;
}

function blank() {
  return "";
}

function center(text, width = RECEIPT_WIDTH) {
  const value = upper(text);
  if (value.length >= width) return value.slice(0, width);
  const pad = Math.floor((width - value.length) / 2);
  return " ".repeat(pad) + value;
}

function padLine(left, right, width = RECEIPT_WIDTH) {
  const leftText = upper(left);
  const rightText = upper(right);
  const spaces = width - leftText.length - rightText.length;
  if (spaces < 1) return truncate(`${leftText} ${rightText}`, width);
  return `${leftText}${" ".repeat(spaces)}${rightText}`;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return upper(
    date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  );
}

function orderTypeLabel(order) {
  return order.payAtPickup ? "CALL-IN" : "WALK-IN";
}

function isEditedItem(item) {
  return Boolean(
    item.sizeName ||
      (item.options?.length ?? 0) > 0 ||
      item.preferences?.trim(),
  );
}

function itemCodePrefix(item) {
  return item.itemCode ? `${item.itemCode} ` : "";
}

function buildPlainItemLine(item) {
  const qtyLabel = `${item.quantity}X`;
  const suffix = ` - ${money(Number(item.price) * item.quantity)}`;
  const prefix = `${qtyLabel} ${itemCodePrefix(item)}`;
  const maxNameLen = RECEIPT_WIDTH - prefix.length - suffix.length;

  if (maxNameLen < 1) {
    return truncate(upper(`${prefix}${suffix}`), RECEIPT_WIDTH);
  }

  return upper(`${prefix}${truncate(item.name, maxNameLen)}${suffix}`);
}

function buildEditedItemLines(item) {
  const lines = [];
  const header = `${item.quantity}X ${itemCodePrefix(item)}${item.name}`;
  lines.push(truncate(upper(header), RECEIPT_WIDTH));

  if (item.sizeName) {
    lines.push(truncate(upper(`  ${item.sizeName}`), RECEIPT_WIDTH));
  }

  const itemOptions = item.options ?? [];
  if (itemOptions.length > 0) {
    const optionNames = itemOptions.map((option) => option.name).join(", ");
    lines.push(truncate(upper(`  ${optionNames}`), RECEIPT_WIDTH));
  }

  if (item.preferences?.trim()) {
    lines.push(truncate(upper(`  ${item.preferences.trim()}`), RECEIPT_WIDTH));
  }

  const lineTotal = money(Number(item.price) * item.quantity);
  lines.push(padLine("", lineTotal));
  return lines;
}

function buildPaymentLines(order) {
  const lines = [];

  if (order.paidStatus === "PAID") {
    if (order.tenderType === "CASH") {
      lines.push(upper("PAID: CASH"));
    } else if (order.tenderType === "CARD") {
      lines.push(upper("PAID: CARD"));
    } else if (order.tenderType === "SPLIT") {
      lines.push(upper(`PAID: CARD ${money(order.cardAmount ?? 0)}`));
      lines.push(upper(`       CASH ${money(order.cashAmount ?? 0)}`));
    }
    return lines;
  }

  if (order.payAtPickup) {
    lines.push(upper("PAY AT PICKUP"));
  }

  return lines;
}

function sendToNetworkPrinter(buffer, config) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      { host: config.printerIp, port: config.printerPort },
      () => {
        socket.write(buffer, () => {
          socket.end();
          resolve({ printed: true });
        });
      },
    );

    socket.setTimeout(PRINTER_TIMEOUT_MS);
    socket.on("timeout", () => {
      socket.destroy();
      reject(appError("Receipt printer timed out", 504));
    });
    socket.on("error", (err) => {
      reject(appError(`Receipt printer error: ${err.message}`, 503));
    });
  });
}

async function sendToUsbPrinter(buffer, config) {
  try {
    await sendRawToWindowsPrinter(
      config.printerName,
      buffer,
      PRINTER_TIMEOUT_MS,
    );
    return { printed: true };
  } catch (err) {
    throw appError(
      `USB printer error (${config.printerName}): ${err.message}`,
      503,
    );
  }
}

function sendToSerialPrinter(buffer, config) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: config.printerComPort,
      baudRate: config.printerBaudRate,
      autoOpen: false,
    });

    const timeout = setTimeout(() => {
      port.close();
      reject(appError("Receipt printer timed out", 504));
    }, PRINTER_TIMEOUT_MS);

    const fail = (message) => {
      clearTimeout(timeout);
      reject(appError(message, 503));
    };

    port.open((err) => {
      if (err) {
        fail(
          `Serial printer error on ${config.printerComPort}: ${err.message}`,
        );
        return;
      }

      port.write(buffer, (writeErr) => {
        if (writeErr) {
          port.close();
          fail(`Serial printer write error: ${writeErr.message}`);
          return;
        }

        port.drain((drainErr) => {
          if (drainErr) {
            port.close();
            fail(`Serial printer drain error: ${drainErr.message}`);
            return;
          }

          port.close((closeErr) => {
            clearTimeout(timeout);
            if (closeErr) {
              fail(`Serial printer close error: ${closeErr.message}`);
              return;
            }
            resolve({ printed: true });
          });
        });
      });
    });
  });
}

function sendToPrinter(buffer) {
  const config = getReceiptConfig();

  switch (config.printerType) {
    case "network":
      return sendToNetworkPrinter(buffer, config);
    case "usb":
      return sendToUsbPrinter(buffer, config);
    case "serial":
      return sendToSerialPrinter(buffer, config);
    default:
      throw appError("Receipt printer is not configured", 400);
  }
}

export function buildOrderReceiptLines(order, config = getReceiptConfig()) {
  const lines = [];
  const storeName = config.storeName || "POS";
  const storeAddress = config.storeAddress?.trim();

  lines.push(blank());
  lines.push(center(storeName));
  if (storeAddress) {
    lines.push(center(storeAddress));
  }
  lines.push(blank());
  lines.push(center(formatDateTime(order.createdAt)));
  lines.push(center(orderTypeLabel(order)));
  lines.push(center(`TICKET #${order.ticketNumber}`));
  lines.push(blank());
  lines.push(upper("-".repeat(RECEIPT_WIDTH)));

  for (const item of order.items ?? []) {
    if (isEditedItem(item)) {
      lines.push(...buildEditedItemLines(item));
    } else {
      lines.push(buildPlainItemLine(item));
    }
    lines.push(blank());
  }

  const total = (order.items ?? []).reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  lines.push(upper("-".repeat(RECEIPT_WIDTH)));
  lines.push(padLine("TOTAL", money(total)));
  lines.push(...buildPaymentLines(order));
  lines.push(blank());
  lines.push(center("THANK YOU!"));
  lines.push(center("PLEASE COME AGAIN!"));
  lines.push(blank());
  lines.push(blank());

  return lines;
}

function buildReceiptBuffer(order, config) {
  const lines = buildOrderReceiptLines(order, config);
  return Buffer.from(`${INIT}${lines.map(line).join("")}${CUT}`, "ascii");
}

function buildTestReceiptBuffer(config) {
  const sampleOrder = {
    ticketNumber: 1,
    payAtPickup: false,
    paidStatus: "PAID",
    tenderType: "CASH",
    createdAt: new Date(),
    items: [
      {
        quantity: 1,
        itemCode: "A1",
        name: "Sample Item",
        price: 9.99,
        sizeName: null,
        options: [],
        preferences: null,
      },
      {
        quantity: 2,
        itemCode: "B2",
        name: "Custom Bowl",
        price: 12.5,
        sizeName: "Large",
        options: [{ name: "Extra Sauce" }],
        preferences: "No onions",
      },
    ],
  };

  const lines = buildOrderReceiptLines(sampleOrder, config);
  return Buffer.from(`${INIT}${lines.map(line).join("")}${CUT}`, "ascii");
}

async function printOrderReceipt(order) {
  const config = getReceiptConfig();

  if (!isReceiptConfigured(config)) {
    console.info(
      "[receipt] skipped (not configured) ticket=%s",
      order.ticketNumber,
    );
    return { printed: false, skipped: true };
  }

  const buffer = buildReceiptBuffer(order, config);
  return sendToPrinter(buffer);
}

export async function printCustomerReceipt(order) {
  return printOrderReceipt(order);
}

export async function printCallInReceipt(order) {
  return printOrderReceipt(order);
}

export async function printTestReceipt() {
  const config = getReceiptConfig();
  if (!isReceiptConfigured(config)) {
    throw appError("Receipt printer is not configured", 400);
  }

  const buffer = buildTestReceiptBuffer(config);
  return sendToPrinter(buffer);
}
