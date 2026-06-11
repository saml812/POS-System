import "dotenv/config";

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CLIENT_URL: process.env.CLIENT_URL,
};