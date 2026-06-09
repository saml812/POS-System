import { prisma } from "./db.js";

export const TICKET_RESET_KEYS = {
  timezone: "ticket_reset.timezone",
  hour: "ticket_reset.hour",
};

const TICKET_RESET_KEY_LIST = [
  TICKET_RESET_KEYS.timezone,
  TICKET_RESET_KEYS.hour,
];

const DEFAULT_DB_VALUES = {
  [TICKET_RESET_KEYS.timezone]: "local",
  [TICKET_RESET_KEYS.hour]: "0",
};

let cachedConfig = null;

function buildConfigFromRows(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const storedTimezone =
    byKey[TICKET_RESET_KEYS.timezone] ?? DEFAULT_DB_VALUES[TICKET_RESET_KEYS.timezone];
  const storedHour =
    byKey[TICKET_RESET_KEYS.hour] ?? DEFAULT_DB_VALUES[TICKET_RESET_KEYS.hour];

  return {
    timeZone:
      storedTimezone.toLowerCase() === "local" ? undefined : storedTimezone,
    resetHour: Number(storedHour),
  };
}

async function loadTicketResetRows() {
  let rows = await prisma.appSetting.findMany({
    where: { key: { in: TICKET_RESET_KEY_LIST } },
  });

  const existingKeys = new Set(rows.map((row) => row.key));
  const toCreate = Object.entries(DEFAULT_DB_VALUES)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({ key, value }));

  if (toCreate.length > 0) {
    await prisma.appSetting.createMany({ data: toCreate });
    rows = [...rows, ...toCreate];
  }

  return rows;
}

export async function refreshTicketResetConfig() {
  const rows = await loadTicketResetRows();
  cachedConfig = buildConfigFromRows(rows);
  return cachedConfig;
}

export function patchTicketResetCache({ timezone, resetHour }) {
  const current = getEffectiveTicketResetConfig();

  cachedConfig = {
    timeZone:
      timezone !== undefined
        ? timezone.toLowerCase() === "local"
          ? undefined
          : timezone
        : current.timeZone,
    resetHour: resetHour !== undefined ? Number(resetHour) : current.resetHour,
  };

  return cachedConfig;
}

export function getEffectiveTicketResetConfig() {
  return cachedConfig ?? buildConfigFromRows([]);
}

export function toPublicTicketResetSettings(config) {
  return {
    ticketReset: {
      timezone: config.timeZone ?? null,
      resetHour: config.resetHour,
    },
  };
}
