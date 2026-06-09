-- CreateIndex
CREATE UNIQUE INDEX "Order_businessDate_ticketNumber_key" ON "Order"("businessDate", "ticketNumber");
