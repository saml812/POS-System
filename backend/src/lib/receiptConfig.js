import { prisma } from "./db.js";

const PRINTER_TYPES = new Set(["network", "usb", "serial", "none"]);

const KEYS = {
  printerType: "receipt.printer_type",
  printerIp: "receipt.printer_ip",
  printerPort: "receipt.printer_port",
  printerName: "receipt.printer_name",
  printerComPort: "receipt.printer_com_port",
  printerBaudRate: "receipt.printer_baud_rate",
  storeName: "receipt.store_name",
};

const DEFAULTS = {
  [KEYS.printerType]: "network",
  [KEYS.printerPort]: "9100",
  [KEYS.printerBaudRate]: "9600",
  [KEYS.storeName]: "POS",
};

let cached = null;

function fromEnv() {
  return {
    printerType: process.env.RECEIPT_PRINTER_TYPE ?? DEFAULTS[KEYS.printerType],
    printerIp: process.env.RECEIPT_PRINTER_IP ?? "",
    printerPort: process.env.RECEIPT_PRINTER_PORT ?? DEFAULTS[KEYS.printerPort],
    printerName: process.env.RECEIPT_PRINTER_NAME ?? "",
    printerComPort: process.env.RECEIPT_PRINTER_COM_PORT ?? "",
    printerBaudRate:
      process.env.RECEIPT_PRINTER_BAUD_RATE ?? DEFAULTS[KEYS.printerBaudRate],
    storeName: process.env.RECEIPT_STORE_NAME ?? DEFAULTS[KEYS.storeName],
  };
}

function readRows(rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const env = fromEnv();

  return {
    printerType: byKey[KEYS.printerType] ?? env.printerType,
    printerIp: byKey[KEYS.printerIp] ?? env.printerIp,
    printerPort: Number(byKey[KEYS.printerPort] ?? env.printerPort),
    printerName: byKey[KEYS.printerName] ?? env.printerName,
    printerComPort: byKey[KEYS.printerComPort] ?? env.printerComPort,
    printerBaudRate: Number(
      byKey[KEYS.printerBaudRate] ?? env.printerBaudRate,
    ),
    storeName: byKey[KEYS.storeName] ?? env.storeName,
  };
}

export function isReceiptConfigured(config) {
  if (config.printerType === "none") return false;
  if (config.printerType === "network") return Boolean(config.printerIp);
  if (config.printerType === "usb") return Boolean(config.printerName);
  if (config.printerType === "serial") return Boolean(config.printerComPort);
  return false;
}

export async function refreshReceiptConfig() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  cached = readRows(rows);
  return cached;
}

export function getReceiptConfig() {
  if (!cached) {
    cached = readRows([]);
  }
  return cached;
}

export function toPublicReceiptSettings(config = getReceiptConfig()) {
  return {
    printerType: config.printerType,
    printerIp: config.printerIp || null,
    printerPort: config.printerPort,
    printerName: config.printerName || null,
    printerComPort: config.printerComPort || null,
    printerBaudRate: config.printerBaudRate,
    storeName: config.storeName,
    configured: isReceiptConfigured(config),
  };
}

export async function updateReceiptSettings(input = {}) {
  const updates = [];

  if (input.printerType !== undefined) {
    const type = String(input.printerType).trim().toLowerCase();
    if (!PRINTER_TYPES.has(type)) {
      throw new Error("Printer type must be network, usb, serial, or none");
    }
    updates.push({ key: KEYS.printerType, value: type });
  }
  if (input.printerIp !== undefined) {
    updates.push({ key: KEYS.printerIp, value: String(input.printerIp).trim() });
  }
  if (input.printerPort !== undefined) {
    const port = Number(input.printerPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Printer port must be between 1 and 65535");
    }
    updates.push({ key: KEYS.printerPort, value: String(port) });
  }
  if (input.printerName !== undefined) {
    updates.push({
      key: KEYS.printerName,
      value: String(input.printerName).trim(),
    });
  }
  if (input.printerComPort !== undefined) {
    updates.push({
      key: KEYS.printerComPort,
      value: String(input.printerComPort).trim(),
    });
  }
  if (input.printerBaudRate !== undefined) {
    const baud = Number(input.printerBaudRate);
    if (!Number.isInteger(baud) || baud < 1) {
      throw new Error("Printer baud rate must be a positive integer");
    }
    updates.push({ key: KEYS.printerBaudRate, value: String(baud) });
  }
  if (input.storeName !== undefined) {
    updates.push({ key: KEYS.storeName, value: String(input.storeName).trim() });
  }

  if (updates.length === 0) {
    throw new Error("No receipt settings provided");
  }

  await prisma.$transaction(
    updates.map(({ key, value }) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  return refreshReceiptConfig();
}

export { KEYS as RECEIPT_SETTING_KEYS };
