import { prisma } from "./db.js";
import { ENV } from "./env.js";

export const TICKET_RESET_KEYS = {
  timezone: "ticket_reset.timezone",
  hour: "ticket_reset.hour",
};

let cachedConfig = null;

export function getEnvTicketResetDefaults() {
  return {
    timeZone: ENV.TICKET_RESET_TIMEZONE,
    resetHour: ENV.TICKET_RESET_HOUR,
  };
}

function buildConfigFromRows(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const envDefaults = getEnvTicketResetDefaults();

  let timeZone = envDefaults.timeZone;
  let resetHour = envDefaults.resetHour;
  const sources = { timezone: "env", hour: "env" };

  if (TICKET_RESET_KEYS.timezone in byKey) {
    const stored = byKey[TICKET_RESET_KEYS.timezone];
    timeZone = stored.toLowerCase() === "local" ? undefined : stored;
    sources.timezone = "db";
  }

  if (TICKET_RESET_KEYS.hour in byKey) {
    resetHour = Number(byKey[TICKET_RESET_KEYS.hour]);
    sources.hour = "db";
  }

  return {
    timeZone,
    resetHour,
    sources,
    envDefaults,
  };
}

export async function refreshTicketResetConfig() {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: { in: [TICKET_RESET_KEYS.timezone, TICKET_RESET_KEYS.hour] },
    },
  });

  cachedConfig = buildConfigFromRows(rows);
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
      timezoneSource: config.sources.timezone,
      resetHourSource: config.sources.hour,
    },
    envDefaults: {
      timezone: config.envDefaults.timeZone ?? null,
      resetHour: config.envDefaults.resetHour,
    },
  };
}
