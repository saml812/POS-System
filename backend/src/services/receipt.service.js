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
const LINE_FEED = "\n";
const PRINTER_TIMEOUT_MS = 5000;
const RECEIPT_WIDTH = 32;

function sanitizeForPrinter(text) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\/+$/g, "")
    .trimEnd();
}

function money(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function upper(text) {
  return sanitizeForPrinter(text).toUpperCase();
}

function truncate(text, max) {
  const value = sanitizeForPrinter(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function line(text = "") {
  return `${text}${LINE_FEED}`;
}

function blank() {
  return "";
}

function formatLeftLine(text, width = RECEIPT_WIDTH) {
  const clipped = truncate(upper(text), width);
  if (clipped.length >= width) return clipped;
  return clipped + " ".repeat(width - clipped.length);
}

function center(text, width = RECEIPT_WIDTH) {
  const value = upper(text);
  if (value.length >= width) return value.slice(0, width);
  const leftPad = Math.floor((width - value.length) / 2);
  const rightPad = width - value.length - leftPad;
  return " ".repeat(leftPad) + value + " ".repeat(rightPad);
}

function centerAddressLines(address) {
  if (!address?.trim()) return [];

  return address
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => center(part));
}

function alignRight(text, width = RECEIPT_WIDTH) {
  const value = upper(text);
  if (value.length >= width) return value.slice(0, width);
  return " ".repeat(width - value.length) + value;
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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours %= 12;
  if (hours === 0) hours = 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day}/${year}, ${hours}:${minutes} ${meridiem}`;
}

function orderTypeLabel(order) {
  return order.payAtPickup ? "CALL-IN" : "WALK-IN";
}

function itemCodePrefix(item) {
  return item.itemCode ? `${item.itemCode} ` : "";
}

function optionName(option) {
  if (typeof option === "string") return sanitizeForPrinter(option);
  return sanitizeForPrinter(option?.name ?? "");
}

function normalizeItem(item) {
  return {
    quantity: Number(item.quantity ?? 1),
    itemCode: item.itemCode ?? null,
    name: sanitizeForPrinter(item.name),
    sizeName: item.sizeName ? sanitizeForPrinter(item.sizeName) : null,
    price: Number(item.price),
    preferences: item.preferences
      ? sanitizeForPrinter(item.preferences)
      : null,
    options: (item.options ?? [])
      .map((option) => ({ name: optionName(option) }))
      .filter((option) => option.name),
  };
}

function buildItemLines(rawItem) {
  const item = normalizeItem(rawItem);
  const lines = [];
  const header = `${item.quantity}x ${itemCodePrefix(item)}${item.name}`;
  lines.push(formatLeftLine(header));

  if (item.sizeName) {
    lines.push(formatLeftLine(`  ${item.sizeName}`));
  }

  if (item.options.length > 0) {
    const optionNames = item.options.map((option) => option.name).join(", ");
    lines.push(formatLeftLine(`  ${optionNames}`));
  }

  if (item.preferences) {
    lines.push(formatLeftLine(`  ${item.preferences}`));
  }

  const lineTotal = money(item.price * item.quantity);
  lines.push(alignRight(lineTotal));
  return lines;
}

function buildPaymentLines(order) {
  const lines = [];

  if (order.paidStatus === "PAID") {
    if (order.tenderType === "CASH") {
      lines.push(formatLeftLine("PAID: CASH"));
    } else if (order.tenderType === "CARD") {
      lines.push(formatLeftLine("PAID: CARD"));
    } else if (order.tenderType === "SPLIT") {
      lines.push(formatLeftLine(`PAID: CARD ${money(order.cardAmount ?? 0)}`));
      lines.push(formatLeftLine(`       CASH ${money(order.cashAmount ?? 0)}`));
    }
    return lines;
  }

  if (order.payAtPickup) {
    lines.push(formatLeftLine("PAY AT PICKUP"));
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
  lines.push(...centerAddressLines(storeAddress));
  lines.push(blank());
  lines.push(center(formatDateTime(order.createdAt)));
  lines.push(center(orderTypeLabel(order)));
  lines.push(center(`TICKET #${order.ticketNumber}`));
  lines.push(blank());
  lines.push(upper("-".repeat(RECEIPT_WIDTH)));

  for (const item of order.items ?? []) {
    lines.push(...buildItemLines(item));
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
  const body = `${INIT}${lines.map(line).join("")}${LINE_FEED}${CUT}`;
  return Buffer.from(body, "ascii");
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
  const body = `${INIT}${lines.map(line).join("")}${LINE_FEED}${CUT}`;
  return Buffer.from(body, "ascii");
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
