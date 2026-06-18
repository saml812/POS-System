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

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function line(text = "") {
  return `${text}${LF}`;
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

  if (order.tenderType === "CASH") {
    lines.push("Paid: CASH");
  } else if (order.tenderType === "CARD") {
    lines.push("Paid: CARD");
  } else if (order.tenderType === "SPLIT") {
    lines.push(`Card: ${money(order.cardAmount ?? 0)}`);
    lines.push(`Cash: ${money(order.cashAmount ?? 0)}`);
  }

  lines.push("");
  lines.push(center("Thank you!"));

  return lines;
}

function buildReceiptBuffer(order, config) {
  const lines = buildOrderReceiptLines(order, config);
  return Buffer.from(`${INIT}${lines.map(line).join("")}${CUT}`, "ascii");
}

function buildTestReceiptBuffer(config) {
  return Buffer.from(
    `${INIT}${line(center(config.storeName || "POS"))}${line(center("Test receipt"))}${line("")}${CUT}`,
    "ascii",
  );
}

export async function printCustomerReceipt(order) {
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

export async function printTestReceipt() {
  const config = getReceiptConfig();
  if (!isReceiptConfigured(config)) {
    throw appError("Receipt printer is not configured", 400);
  }

  const buffer = buildTestReceiptBuffer(config);
  return sendToPrinter(buffer);
}
