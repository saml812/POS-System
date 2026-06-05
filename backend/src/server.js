import express from "express";
import cors from "cors";
import session from "express-session";
import { ENV } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = Number(ENV.PORT) || 3000;

app.use(
  cors({
    origin: ENV.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: ENV.SESSION_SECRET ?? "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: ENV.NODE_ENV === "production" ? "strict" : "lax",
      secure: ENV.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use("/api", healthRoutes);
app.use("/api", authRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on PORT ${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(async () => {
    await disconnectDB();
    process.exit(1);
  });
});

process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await disconnectDB();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});
