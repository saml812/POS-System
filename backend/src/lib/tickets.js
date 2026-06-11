import { prisma } from "./db.js";

const KEYS = {
  timezone: "ticket_reset.timezone",
  hour: "ticket_reset.hour",
};

const DEFAULTS = {
  [KEYS.timezone]: "local",
  [KEYS.hour]: "0",
};

const ALL_KEYS = Object.values(KEYS);

let config = null;

function tzOptions(timeZone, options) {
  return { ...options, ...(timeZone && { timeZone }) };
}

function normalizeTimezone(value) {
  const stored = value ?? DEFAULTS[KEYS.timezone];
  return stored.toLowerCase() === "local" ? undefined : stored;
}

function parseHour(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(
      `Ticket reset hour must be an integer from 0 to 23, got "${value}"`,
    );
  }

  return hour;
}

function parseTimezone(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "local") {
    return undefined;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone: ${trimmed}`);
  }

  return trimmed;
}

function readConfig(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    timeZone: normalizeTimezone(byKey[KEYS.timezone]),
    resetHour: Number(byKey[KEYS.hour] ?? DEFAULTS[KEYS.hour]),
  };
}

function getConfig() {
  return config ?? readConfig([]);
}

function applyConfigPatch({ timezone, resetHour }) {
  const current = getConfig();

  config = {
    timeZone:
      timezone !== undefined ? normalizeTimezone(timezone) : current.timeZone,
    resetHour: resetHour !== undefined ? Number(resetHour) : current.resetHour,
  };

  return config;
}

async function ensureDefaultSettings() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ALL_KEYS } },
  });

  const existingKeys = new Set(rows.map((row) => row.key));
  const missing = Object.entries(DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({ key, value }));

  if (missing.length === 0) {
    return rows;
  }

  await prisma.appSetting.createMany({ data: missing });
  return [...rows, ...missing];
}

function upsertSetting(key, value) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function lastTicketIssued(client, businessDate) {
  const rows = await client.$queryRaw`
    SELECT MAX("ticketNumber") AS max
    FROM "Order"
    WHERE "businessDate" = ${businessDate}
  `;

  const max = rows[0]?.max;
  return max == null ? 0 : Number(max);
}

function formatYmd(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", tzOptions(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })).format(date);
}

function hourInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", tzOptions(timeZone, {
    hour: "numeric",
    hourCycle: "h23",
  })).formatToParts(date);

  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

export async function refreshTicketResetConfig() {
  config = readConfig(await ensureDefaultSettings());
  return config;
}

export async function updateTicketResetSettings({ timezone, resetHour } = {}) {
  const changes = [];

  if (timezone !== undefined) {
    const stored = parseTimezone(timezone) ?? "local";
    changes.push({
      key: KEYS.timezone,
      value: stored,
      patch: { timezone: stored },
    });
  }

  if (resetHour !== undefined) {
    const hour = parseHour(resetHour);
    changes.push({
      key: KEYS.hour,
      value: String(hour),
      patch: { resetHour: hour },
    });
  }

  if (changes.length === 0) {
    throw new Error("No settings provided");
  }

  await prisma.$transaction(
    changes.map(({ key, value }) => upsertSetting(key, value)),
  );

  applyConfigPatch(Object.assign({}, ...changes.map(({ patch }) => patch)));
}

export async function getPublicSettings() {
  const { timeZone, resetHour } = getConfig();

  return {
    ticketReset: {
      timezone: timeZone ?? null,
      resetHour,
    },
    ticketStatus: await getTicketStatus(),
  };
}

export function getBusinessDate(now = new Date()) {
  const { timeZone, resetHour } = getConfig();
  const today = formatYmd(now, timeZone);

  if (resetHour === 0 || hourInTimezone(now, timeZone) >= resetHour) {
    return today;
  }

  const [year, month, day] = today.split("-").map(Number);
  return formatYmd(new Date(year, month - 1, day - 1));
}

export async function getNextTicketNumber(tx, businessDate) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${businessDate}))
  `;

  return (await lastTicketIssued(tx, businessDate)) + 1;
}

export async function getTicketStatus() {
  const businessDate = getBusinessDate();

  return {
    businessDate,
    lastTicketNumber: await lastTicketIssued(prisma, businessDate),
  };
}
