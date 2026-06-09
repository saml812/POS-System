import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getShiftStatus } from "../lib/shiftStatus.js";
import {
  getEffectiveTicketResetConfig,
  patchTicketResetCache,
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
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getSettings() {
  const config = getEffectiveTicketResetConfig();
  const ticketStatus = await getShiftStatus();

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
  const cachePatch = {};

  if (timezone !== undefined) {
    const value = parseField(parseTicketResetTimezone, timezone) ?? "local";
    updates.push(ticketResetMutation(TICKET_RESET_KEYS.timezone, value));
    cachePatch.timezone = value;
  }

  if (resetHour !== undefined) {
    const value = String(parseField(parseTicketResetHour, resetHour));
    updates.push(ticketResetMutation(TICKET_RESET_KEYS.hour, value));
    cachePatch.resetHour = Number(value);
  }

  await prisma.$transaction(updates);
  patchTicketResetCache(cachePatch);

  return getSettings();
}

