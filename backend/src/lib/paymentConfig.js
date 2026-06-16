import { prisma } from "./db.js";
import { ENV } from "./env.js";

export const TERMINAL_HTTPS_PORT = 443;

const KEYS = {
  terminalIp: "payment.terminal_ip",
  merchantId: "payment.merchant_id",
  operationMode: "payment.operation_mode",
  storeName: "receipt.store_name",
};

const DEFAULTS = {
  [KEYS.operationMode]: "CERT",
  [KEYS.storeName]: "POS",
};

let cached = null;

function terminalTlsStrict() {
  return process.env.PAYMENT_TERMINAL_TLS_STRICT === "true";
}

function fromEnv() {
  return {
    terminalIp: process.env.PAYMENT_TERMINAL_IP ?? "",
    terminalPort: TERMINAL_HTTPS_PORT,
    merchantId: process.env.PAYMENT_MERCHANT_ID ?? "",
    operationMode: process.env.PAYMENT_OPERATION_MODE ?? DEFAULTS[KEYS.operationMode],
    terminalTlsStrict: terminalTlsStrict(),
    storeName: process.env.RECEIPT_STORE_NAME ?? DEFAULTS[KEYS.storeName],
  };
}

function readRows(rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const env = fromEnv();

  return {
    terminalIp: byKey[KEYS.terminalIp] ?? env.terminalIp,
    terminalPort: TERMINAL_HTTPS_PORT,
    merchantId: byKey[KEYS.merchantId] ?? env.merchantId,
    operationMode: byKey[KEYS.operationMode] ?? env.operationMode,
    terminalTlsStrict: terminalTlsStrict(),
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
  const terminalConfigured = Boolean(config.terminalIp && config.merchantId);

  return {
    terminal: {
      ip: config.terminalIp || null,
      port: TERMINAL_HTTPS_PORT,
      merchantId: config.merchantId || null,
      operationMode: config.operationMode,
      configured: terminalConfigured,
    },
    receipt: {
      storeName: config.storeName,
      configured: terminalConfigured,
    },
  };
}

export async function updatePaymentSettings(input = {}) {
  const updates = [];

  if (input.terminalIp !== undefined) {
    updates.push({ key: KEYS.terminalIp, value: String(input.terminalIp).trim() });
  }
  if (input.terminalPort !== undefined && Number(input.terminalPort) !== TERMINAL_HTTPS_PORT) {
    throw new Error(`Terminal port must be ${TERMINAL_HTTPS_PORT} (HTTPS only)`);
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
