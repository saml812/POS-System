import { ENV } from "./env.js";

export function getClientOrigins() {
  const origins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  if (ENV.CLIENT_URL) {
    for (const url of ENV.CLIENT_URL.split(",")) {
      const trimmed = url.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return [...origins];
}

export function isClientOrigin(origin) {
  return !origin || getClientOrigins().includes(origin);
}
