import "dotenv/config";
import {
  parseTicketResetHour,
  parseTicketResetTimezone,
} from "./ticketResetParsers.js";

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CLIENT_URL: process.env.CLIENT_URL,
  TICKET_RESET_TIMEZONE: parseTicketResetTimezone(process.env.TICKET_RESET_TIMEZONE),
  TICKET_RESET_HOUR: parseTicketResetHour(process.env.TICKET_RESET_HOUR),
};
