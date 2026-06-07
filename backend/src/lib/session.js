import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import { prisma } from "./db.js";
import { ENV } from "./env.js";

export const sessionStore = new PrismaSessionStore(prisma, {
  checkPeriod: 2 * 60 * 1000,
  dbRecordIdIsSessionId: true,
});

export const sessionMiddleware = session({
  store: sessionStore,
  secret: ENV.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: ENV.NODE_ENV === "production" ? "strict" : "lax",
    secure: ENV.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8,
  },
});
