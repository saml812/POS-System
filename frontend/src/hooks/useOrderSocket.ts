import { useEffect, useRef } from "react";
import { connectSocket } from "../lib/socket";
import type { Order } from "../types";

export type OrderSocketEvent =
  | "order:created"
  | "order:updated"
  | "order:completed"
  | "order:cancelled";

export type OrderSocketRoom = "kitchen" | "cashier";

const ORDER_EVENTS: OrderSocketEvent[] = [
  "order:created",
  "order:updated",
  "order:completed",
  "order:cancelled",
];

type UseOrderSocketOptions = {
  enabled?: boolean;
  room?: OrderSocketRoom;
  onOrder: (event: OrderSocketEvent, order: Order) => void;
};

export function useOrderSocket({
  enabled = true,
  room,
  onOrder,
}: UseOrderSocketOptions) {
  const onOrderRef = useRef(onOrder);

  useEffect(() => {
    onOrderRef.current = onOrder;
  }, [onOrder]);

  useEffect(() => {
    if (!enabled) return;

    const socket = connectSocket();
    if (room) {
      socket.emit("join", room);
    }

    const handlers = ORDER_EVENTS.map((event) => {
      const handler = (order: Order) => {
        onOrderRef.current(event, order);
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      for (const { event, handler } of handlers) {
        socket.off(event, handler);
      }
    };
  }, [enabled, room]);
}
