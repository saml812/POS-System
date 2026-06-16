import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getBusinessDate } from "../lib/tickets.js";
import { computeItemsTotal } from "./checkout.service.js";

const SALES_WHERE = {
  paidStatus: "PAID",
  status: { not: "CANCELLED" },
};

const ORDER_EXPORT_INCLUDE = {
  items: { include: { options: true } },
  placedBy: { select: { email: true } },
  completedBy: { select: { email: true } },
};

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function toSalesTotals(aggregate) {
  const cardAmount = roundMoney(Number(aggregate._sum.cardAmount ?? 0));
  const cashAmount = roundMoney(Number(aggregate._sum.cashAmount ?? 0));

  return {
    totalSales: roundMoney(cardAmount + cashAmount),
    cardAmount,
    cashAmount,
    orderCount: aggregate._count,
  };
}

function parseBusinessDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw appError(`${label} must be YYYY-MM-DD`);
  }

  return value;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function orderLineTotal(order) {
  if (order.cardAmount != null || order.cashAmount != null) {
    return roundMoney(Number(order.cardAmount ?? 0) + Number(order.cashAmount ?? 0));
  }

  return computeItemsTotal(order.items);
}

function buildOrderCsvRow(order) {
  const total = orderLineTotal(order);
  const itemsSummary = order.items
    .map((item) => {
      const options = (item.options ?? [])
        .map((option) => option.name)
        .filter(Boolean)
        .join("; ");
      const size = item.sizeName ? ` (${item.sizeName})` : "";
      const suffix = options ? ` [${options}]` : "";
      return `${item.quantity}x ${item.name}${size}${suffix}`;
    })
    .join(" | ");

  return [
    order.businessDate,
    order.ticketNumber,
    order.completedAt?.toISOString() ?? "",
    order.tenderType ?? "",
    order.cardAmount != null ? Number(order.cardAmount) : "",
    order.cashAmount != null ? Number(order.cashAmount) : "",
    total,
    order.placedBy?.email ?? "",
    order.completedBy?.email ?? "",
    itemsSummary,
  ]
    .map(csvEscape)
    .join(",");
}

export async function getSalesSummary() {
  const businessDate = getBusinessDate();
  const monthPrefix = businessDate.slice(0, 7);

  const [daily, monthly] = await Promise.all([
    prisma.order.aggregate({
      where: { ...SALES_WHERE, businessDate },
      _sum: { cardAmount: true, cashAmount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        ...SALES_WHERE,
        businessDate: { startsWith: monthPrefix },
      },
      _sum: { cardAmount: true, cashAmount: true },
      _count: true,
    }),
  ]);

  return {
    businessDate,
    month: monthPrefix,
    daily: toSalesTotals(daily),
    monthly: toSalesTotals(monthly),
  };
}

export async function exportCompletedOrdersCsv(beforeDateInput) {
  const beforeDate = parseBusinessDate(beforeDateInput, "beforeDate");

  const orders = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
      paidStatus: "PAID",
      businessDate: { lt: beforeDate },
    },
    include: ORDER_EXPORT_INCLUDE,
    orderBy: [{ businessDate: "asc" }, { ticketNumber: "asc" }],
  });

  const header = [
    "businessDate",
    "ticketNumber",
    "completedAt",
    "tenderType",
    "cardAmount",
    "cashAmount",
    "total",
    "placedBy",
    "completedBy",
    "items",
  ].join(",");

  const rows = orders.map(buildOrderCsvRow);
  const csv = [header, ...rows].join("\n");

  return {
    beforeDate,
    orderCount: orders.length,
    filename: `pos-orders-before-${beforeDate}.csv`,
    csv,
  };
}

export async function archiveCompletedOrders(beforeDateInput) {
  const beforeDate = parseBusinessDate(beforeDateInput, "beforeDate");
  const exported = await exportCompletedOrdersCsv(beforeDate);

  if (exported.orderCount === 0) {
    return { ...exported, deletedCount: 0 };
  }

  const deleted = await prisma.order.deleteMany({
    where: {
      status: "COMPLETED",
      paidStatus: "PAID",
      businessDate: { lt: beforeDate },
    },
  });

  return {
    ...exported,
    deletedCount: deleted.count,
  };
}
