-- Filter: WHERE businessDate = $1 (ticket status, feed queries, MAX(ticketNumber))
CREATE INDEX IF NOT EXISTS "Order_businessDate_idx" ON "Order"("businessDate");

-- MAX(ticketNumber) per business day: leftmost column match + ticketNumber in index
CREATE UNIQUE INDEX IF NOT EXISTS "Order_businessDate_ticketNumber_key"
ON "Order"("businessDate", "ticketNumber");
