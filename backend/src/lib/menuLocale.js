export function parseLocale(value) {
  return value === "zh" ? "zh" : "en";
}

export function parseOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}
