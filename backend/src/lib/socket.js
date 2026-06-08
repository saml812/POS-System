import { Server } from "socket.io";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
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

  if (["PENDING", "IN_PROGRESS", "FINISHED", "CANCELLED"].includes(order.status)) {
    io.to("kitchen").emit(event, order);
  }

  if (["IN_PROGRESS", "FINISHED"].includes(order.status)) {
    io.to("cashier").emit(event, order);
  }
}
