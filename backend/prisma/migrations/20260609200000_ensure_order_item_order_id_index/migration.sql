-- Indexed lookup: OrderItem WHERE orderId = Order.id (feed lateral joins)
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
