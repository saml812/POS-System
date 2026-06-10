import express from "express";
import cors from "cors";
import { createServer } from "http";
import passport from "./lib/passport.js";
import { sessionMiddleware, sessionStore } from "./lib/session.js";
import { initSocket } from "./lib/socket.js";
import { ENV } from "./lib/env.js";
import { connectDB, disconnectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import kitchenRoutes from "./routes/kitchen.routes.js";
import cashierRoutes from "./routes/cashier.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import { refreshTicketResetConfig } from "./lib/tickets.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();
const httpServer = createServer(app);
const PORT = ENV.PORT || 3000;

app.use(
  cors({
    origin: ENV.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/cashier", cashierRoutes);
app.use("/api/settings", settingsRoutes);

app.use(notFound);
app.use(errorHandler);

initSocket(httpServer);

const server = httpServer.listen(PORT, async () => {
  await connectDB();
  await refreshTicketResetConfig();
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

async function shutdown() {
  await sessionStore.shutdown();
  await disconnectDB();
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    await shutdown();
    process.exit(0);
  });
});