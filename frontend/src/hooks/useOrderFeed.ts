import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "../types";
import {
  useOrderSocket,
  type OrderSocketEvent,
  type OrderSocketRoom,
} from "./useOrderSocket";
import { useGuardedLoad } from "./useGuardedLoad";

type UseOrderFeedOptions = {
  enabled: boolean;
  load: () => Promise<{ orders: Order[] }>;
  room?: OrderSocketRoom;
  applyEvent: (orders: Order[], order: Order) => Order[];
  onOrderEvent?: (event: OrderSocketEvent, order: Order) => void;
};

export function useOrderFeed({
  enabled,
  load,
  room,
  applyEvent,
  onOrderEvent,
}: UseOrderFeedOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const onOrderEventRef = useRef(onOrderEvent);

  useEffect(() => {
    onOrderEventRef.current = onOrderEvent;
  }, [onOrderEvent]);

  const reload = useCallback(async () => {
    const data = await load();
    setOrders(data.orders);
  }, [load]);

  const { loading, error, setError } = useGuardedLoad(enabled, reload);

  useOrderSocket({
    enabled,
    room,
    onOrder: (event, order) => {
      onOrderEventRef.current?.(event, order);
      setOrders((current) => applyEvent(current, order));
    },
  });

  return {
    orders,
    setOrders,
    loading,
    error,
    setError,
    reload,
  };
}
