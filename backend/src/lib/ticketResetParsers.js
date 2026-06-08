export function parseTicketResetHour(value) {
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

export function parseTicketResetTimezone(value) {
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
