import { ENV } from "./env.js";

export function getClientOrigins() {
  const origins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  if (ENV.CLIENT_URL) {
    origins.add(ENV.CLIENT_URL);
  }

  return [...origins];
}

export function isClientOrigin(origin) {
  return !origin || getClientOrigins().includes(origin);
}
