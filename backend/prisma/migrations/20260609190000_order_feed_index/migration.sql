-- CreateIndex
CREATE INDEX "Order_businessDate_status_ticketNumber_idx" ON "Order"("businessDate", "status", "ticketNumber");
