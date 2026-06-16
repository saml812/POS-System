import { io, type Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? undefined;

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  } else if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
