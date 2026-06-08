import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getBusinessDate, getTicketCounterKey } from "../lib/shift.js";
import {
  getEffectiveTicketResetConfig,
  refreshTicketResetConfig,
  TICKET_RESET_KEYS,
  toPublicTicketResetSettings,
} from "../lib/ticketResetConfig.js";
import {
  parseTicketResetHour,
  parseTicketResetTimezone,
} from "../lib/ticketResetParsers.js";

function parseField(parser, value) {
  try {
    return parser(value);
  } catch (err) {
    throw appError(err.message);
  }
}

function ticketResetMutation(key, value) {
  if (value === null) {
    return prisma.appSetting.deleteMany({ where: { key } });
  }

  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function getTicketStatus() {
  const businessDate = getBusinessDate();
  const counter = await prisma.appSetting.findUnique({
    where: { key: getTicketCounterKey(businessDate) },
  });

  return {
    businessDate,
    lastTicketNumber: counter ? Number(counter.value) : 0,
  };
}

export async function getSettings() {
  const config = getEffectiveTicketResetConfig();
  const ticketStatus = await getTicketStatus();

  return {
    ...toPublicTicketResetSettings(config),
    ticketStatus,
  };
}

export async function updateTicketReset({ timezone, resetHour }) {
  if (timezone === undefined && resetHour === undefined) {
    throw appError("No settings provided");
  }

  const updates = [];

  if (timezone !== undefined) {
    const value =
      timezone === null
        ? null
        : parseField(parseTicketResetTimezone, timezone) ?? "local";
    updates.push(ticketResetMutation(TICKET_RESET_KEYS.timezone, value));
  }

  if (resetHour !== undefined) {
    const value =
      resetHour === null
        ? null
        : String(parseField(parseTicketResetHour, resetHour));
    updates.push(ticketResetMutation(TICKET_RESET_KEYS.hour, value));
  }

  await prisma.$transaction(updates);
  await refreshTicketResetConfig();

  return getSettings();
}

export async function resetTicketResetToEnvDefaults() {
  await prisma.appSetting.deleteMany({
    where: {
      key: { in: [TICKET_RESET_KEYS.timezone, TICKET_RESET_KEYS.hour] },
    },
  });
  await refreshTicketResetConfig();
  return getSettings();
}
