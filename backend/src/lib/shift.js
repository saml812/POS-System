import { getEffectiveTicketResetConfig } from "./ticketResetConfig.js";

function subtractCalendarDay(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getHourInTimezone(now, timeZone) {
  const options = { hour: "numeric", hourCycle: "h23" };
  if (timeZone) {
    options.timeZone = timeZone;
  }

  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

export function getBusinessDateForConfig(
  now = new Date(),
  { timeZone, resetHour = 0 } = {},
) {
  const dateOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  if (timeZone) {
    dateOptions.timeZone = timeZone;
  }

  const calendarDate = new Intl.DateTimeFormat("en-CA", dateOptions).format(now);

  if (resetHour === 0) {
    return calendarDate;
  }

  const hour = getHourInTimezone(now, timeZone);
  if (hour < resetHour) {
    return subtractCalendarDay(calendarDate);
  }

  return calendarDate;
}

export function getBusinessDate(now = new Date()) {
  const { timeZone, resetHour } = getEffectiveTicketResetConfig();
  return getBusinessDateForConfig(now, { timeZone, resetHour });
}

export async function getNextTicketNumberForShift(tx, businessDate) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`shift:${businessDate}`}))
  `;

  const rows = await tx.$queryRaw`
    SELECT COALESCE(MAX("ticketNumber"), 0) + 1 AS next
    FROM "Order"
    WHERE "businessDate" = ${businessDate}
  `;

  return Number(rows[0].next);
}
