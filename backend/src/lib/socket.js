import { Server } from "socket.io";
import { getClientOrigins } from "./clientOrigins.js";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: getClientOrigins(),
      credentials: true,
      pingInterval: 25000,
      pingTimeout: 20000,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", (room) => {
      if (room === "kitchen" || room === "cashier") {
        socket.join(room);
      }
    });
  });

  return io;
}

export function emitOrderEvent(event, order) {
  if (!io) return;

  io.emit(event, order);
}
