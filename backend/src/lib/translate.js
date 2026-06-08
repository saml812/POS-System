import { ENV } from "./env.js";

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

const cache = new Map();

export function isTranslationEnabled() {
  return Boolean(ENV.GOOGLE_TRANSLATE_API_KEY);
}

async function callGoogle(texts, source, target) {
  const response = await fetch(`${ENDPOINT}?key=${ENV.GOOGLE_TRANSLATE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, source, target, format: "text" }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Google Translate request failed (${response.status}): ${detail}`,
    );
  }

  const payload = await response.json();
  return (payload?.data?.translations ?? []).map((t) => t.translatedText);
}

export async function translateTexts(texts, { source = "en", target = "zh-CN" } = {}) {
  const result = new Map();
  if (!isTranslationEnabled()) {
    return result;
  }

  const unique = [...new Set(texts.map((t) => (t ?? "").trim()).filter(Boolean))];
  if (unique.length === 0) {
    return result;
  }

  const misses = [];
  for (const text of unique) {
    const key = `${target}:${text}`;
    if (cache.has(key)) {
      result.set(text, cache.get(key));
    } else {
      misses.push(text);
    }
  }

  if (misses.length > 0) {
    const translated = await callGoogle(misses, source, target);
    misses.forEach((text, index) => {
      const output = translated[index];
      if (output) {
        cache.set(`${target}:${text}`, output);
        result.set(text, output);
      }
    });
  }

  return result;
}
