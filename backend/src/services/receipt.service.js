import net from "node:net";
import { getPaymentConfig } from "../lib/paymentConfig.js";
import { appError } from "../lib/appError.js";

const ESC = "\x1b";
const INIT = ESC + "@";
const CUT = ESC + "i";
const LF = "\n";
const PRINTER_TIMEOUT_MS = 5000;

function money(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function line(text = "") {
  return `${text}${LF}`;
}

function center(text, width = 32) {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text;
}

function sendToPrinter(buffer) {
  const config = getPaymentConfig();

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

function buildReceiptBuffer(order, config) {
  const total = order.items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  const lines = [
    INIT,
    line(center(config.storeName || "POS")),
    line(center(`Ticket #${order.ticketNumber}`)),
    line("-".repeat(32)),
  ];

  for (const item of order.items) {
    const label = item.itemCode
      ? `${item.quantity}x ${item.itemCode} ${item.name}`
      : `${item.quantity}x ${item.name}`;
    const price = money(Number(item.price) * item.quantity);
    lines.push(line(label.slice(0, 24)));
    if (item.sizeName) lines.push(line(`  ${item.sizeName}`));
    lines.push(line(`  ${price}`));
  }

  lines.push(line("-".repeat(32)));
  lines.push(line(`Total: ${money(total)}`));

  if (order.paymentMethod === "CASH") {
    lines.push(line("Paid: CASH"));
  } else if (order.paymentMethod === "CARD") {
    lines.push(line("Paid: CARD"));
  } else if (order.paymentMethod === "SPLIT") {
    lines.push(line(`Card: ${money(order.cardAmount ?? 0)}`));
    lines.push(line(`Cash: ${money(order.cashAmount ?? 0)}`));
  }

  lines.push(line(""));
  lines.push(line(center("Thank you!")));
  lines.push(line(""));
  lines.push(CUT);

  return Buffer.from(lines.join(""), "ascii");
}

export async function printCustomerReceipt(order) {
  const config = getPaymentConfig();

  if (config.printerType === "none" || !config.printerIp) {
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
  const config = getPaymentConfig();
  if (config.printerType === "none" || !config.printerIp) {
    throw appError("Receipt printer is not configured", 400);
  }

  const buffer = Buffer.from(
    `${INIT}${line(center(config.storeName || "POS"))}${line(center("Test receipt"))}${line("")}${CUT}`,
    "ascii",
  );

  return sendToPrinter(buffer);
}
