export function parseLocale(value) {
  return value === "zh" ? "zh" : "en";
}

export function localizedName(record, locale) {
  if (locale === "zh" && record.nameZh?.trim()) {
    return record.nameZh.trim();
  }
  return record.name;
}

export function localizedDescription(record, locale) {
  if (locale === "zh" && record.descriptionZh?.trim()) {
    return record.descriptionZh.trim();
  }
  return record.description ?? null;
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
