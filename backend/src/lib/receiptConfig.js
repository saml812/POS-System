import { prisma } from "./db.js";

const KEYS = {
  printerType: "receipt.printer_type",
  printerIp: "receipt.printer_ip",
  printerPort: "receipt.printer_port",
  storeName: "receipt.store_name",
};

const DEFAULTS = {
  [KEYS.printerType]: "network",
  [KEYS.printerPort]: "9100",
  [KEYS.storeName]: "POS",
};

let cached = null;

function fromEnv() {
  return {
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
    printerType: byKey[KEYS.printerType] ?? env.printerType,
    printerIp: byKey[KEYS.printerIp] ?? env.printerIp,
    printerPort: Number(byKey[KEYS.printerPort] ?? env.printerPort),
    storeName: byKey[KEYS.storeName] ?? env.storeName,
  };
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
    storeName: config.storeName,
    configured: Boolean(config.printerIp && config.printerType !== "none"),
  };
}

export async function updateReceiptSettings(input = {}) {
  const updates = [];

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
