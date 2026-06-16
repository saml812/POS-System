import { prisma } from "./db.js";
import { ENV } from "./env.js";

const KEYS = {
  terminalIp: "payment.terminal_ip",
  terminalPort: "payment.terminal_port",
  merchantId: "payment.merchant_id",
  operationMode: "payment.operation_mode",
  printerType: "receipt.printer_type",
  printerIp: "receipt.printer_ip",
  printerPort: "receipt.printer_port",
  storeName: "receipt.store_name",
};

const DEFAULTS = {
  [KEYS.terminalPort]: "80",
  [KEYS.operationMode]: "CERT",
  [KEYS.printerType]: "network",
  [KEYS.printerPort]: "9100",
  [KEYS.storeName]: "POS",
};

let cached = null;

function fromEnv() {
  return {
    terminalIp: process.env.PAYMENT_TERMINAL_IP ?? "",
    terminalPort: process.env.PAYMENT_TERMINAL_PORT ?? DEFAULTS[KEYS.terminalPort],
    merchantId: process.env.PAYMENT_MERCHANT_ID ?? "",
    operationMode: process.env.PAYMENT_OPERATION_MODE ?? DEFAULTS[KEYS.operationMode],
    printerType: process.env.RECEIPT_PRINTER_TYPE ?? DEFAULTS[KEYS.printerType],
    printerIp: process.env.RECEIPT_PRINTER_IP ?? "",
    printerPort: process.env.RECEIPT_PRINTER_PORT ?? DEFAULTS[KEYS.printerPort],
    storeName: process.env.RECEIPT_STORE_NAME ?? DEFAULTS[KEYS.storeName],
  };
}

function readRows(rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const env = fromEnv();

  return {
    terminalIp: byKey[KEYS.terminalIp] ?? env.terminalIp,
    terminalPort: Number(byKey[KEYS.terminalPort] ?? env.terminalPort),
    merchantId: byKey[KEYS.merchantId] ?? env.merchantId,
    operationMode: byKey[KEYS.operationMode] ?? env.operationMode,
    printerType: byKey[KEYS.printerType] ?? env.printerType,
    printerIp: byKey[KEYS.printerIp] ?? env.printerIp,
    printerPort: Number(byKey[KEYS.printerPort] ?? env.printerPort),
    storeName: byKey[KEYS.storeName] ?? env.storeName,
  };
}

export async function refreshPaymentConfig() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  cached = readRows(rows);
  return cached;
}

export function getPaymentConfig() {
  if (!cached) {
    cached = readRows([]);
  }
  return cached;
}

export function toPublicPaymentSettings(config = getPaymentConfig()) {
  return {
    terminal: {
      ip: config.terminalIp || null,
      port: config.terminalPort,
      merchantId: config.merchantId || null,
      operationMode: config.operationMode,
      configured: Boolean(config.terminalIp && config.merchantId),
    },
    receipt: {
      printerType: config.printerType,
      printerIp: config.printerIp || null,
      printerPort: config.printerPort,
      storeName: config.storeName,
      configured: Boolean(config.printerIp),
    },
  };
}

export async function updatePaymentSettings(input = {}) {
  const updates = [];

  if (input.terminalIp !== undefined) {
    updates.push({ key: KEYS.terminalIp, value: String(input.terminalIp).trim() });
  }
  if (input.terminalPort !== undefined) {
    const port = Number(input.terminalPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Terminal port must be between 1 and 65535");
    }
    updates.push({ key: KEYS.terminalPort, value: String(port) });
  }
  if (input.merchantId !== undefined) {
    updates.push({ key: KEYS.merchantId, value: String(input.merchantId).trim() });
  }
  if (input.operationMode !== undefined) {
    const mode = String(input.operationMode).trim().toUpperCase();
    if (mode !== "CERT" && mode !== "PROD") {
      throw new Error("Operation mode must be CERT or PROD");
    }
    if (ENV.NODE_ENV === "production" && mode === "CERT") {
      throw new Error("CERT mode is not allowed when NODE_ENV is production");
    }
    updates.push({ key: KEYS.operationMode, value: mode });
  }
  if (input.printerType !== undefined) {
    const type = String(input.printerType).trim().toLowerCase();
    if (type !== "network" && type !== "none") {
      throw new Error("Printer type must be network or none");
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
  if (input.storeName !== undefined) {
    updates.push({ key: KEYS.storeName, value: String(input.storeName).trim() });
  }

  if (updates.length === 0) {
    throw new Error("No payment settings provided");
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

  return refreshPaymentConfig();
}

export { KEYS as PAYMENT_SETTING_KEYS };
