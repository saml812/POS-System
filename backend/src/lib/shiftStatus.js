import { prisma } from "./db.js";
import { getBusinessDate } from "./shift.js";

export async function getShiftStatus() {
  const businessDate = getBusinessDate();
  const summary = await prisma.order.aggregate({
    where: { businessDate },
    _max: { ticketNumber: true },
  });

  return {
    businessDate,
    lastTicketNumber: summary._max.ticketNumber ?? 0,
  };
}
