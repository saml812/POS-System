import { useCallback, useState } from "react";
import type { Order } from "../types";
import {
  useOrderSocket,
  type OrderSocketRoom,
} from "./useOrderSocket";
import { useGuardedLoad } from "./useGuardedLoad";

type UseOrderFeedOptions = {
  enabled: boolean;
  load: () => Promise<{ orders: Order[] }>;
  room?: OrderSocketRoom;
  applyEvent: (orders: Order[], order: Order) => Order[];
};

export function useOrderFeed({
  enabled,
  load,
  room,
  applyEvent,
}: UseOrderFeedOptions) {
  const [orders, setOrders] = useState<Order[]>([]);

  const reload = useCallback(async () => {
    const data = await load();
    setOrders(data.orders);
  }, [load]);

  const { loading, error, setError } = useGuardedLoad(enabled, reload);

  useOrderSocket({
    enabled,
    room,
    onOrder: (_event, order) => {
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
