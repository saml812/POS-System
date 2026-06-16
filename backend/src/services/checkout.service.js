import { appError } from "../lib/appError.js";
import { printCustomerReceipt } from "./receipt.service.js";

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function computeItemsTotal(items) {
  return roundMoney(
    items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
  );
}

export function parseTenderPayload(tender, total) {
  if (!tender || typeof tender !== "object") {
    throw appError("Tender is required for walk-in orders");
  }

  const method = String(tender.method ?? "").toUpperCase();
  if (!["CASH", "CARD", "SPLIT"].includes(method)) {
    throw appError("Invalid tender method");
  }

  if (method === "CASH") {
    if (tender.cardAmount !== undefined && tender.cardAmount !== null) {
      throw appError("cardAmount is not allowed for cash tender");
    }
    return {
      method: "CASH",
      cardAmount: 0,
      cashAmount: total,
    };
  }

  if (method === "CARD") {
    return {
      method: "CARD",
      cardAmount: total,
      cashAmount: 0,
    };
  }

  const cardAmount = roundMoney(tender.cardAmount);
  if (!Number.isFinite(cardAmount) || cardAmount <= 0 || cardAmount >= total) {
    throw appError("Split card amount must be between 0 and order total");
  }

  return {
    method: "SPLIT",
    cardAmount,
    cashAmount: roundMoney(total - cardAmount),
  };
}

async function safePrintReceipt(order) {
  try {
    await printCustomerReceipt(order);
  } catch (err) {
    console.error("[receipt] print failed", order.id, err.message);
  }
}

export function buildPaidEffects(parsed) {
  return {
    tenderType: parsed.method,
    paidStatus: "PAID",
    cardAmount: parsed.cardAmount,
    cashAmount: parsed.cashAmount,
    printReceipt: true,
  };
}

export function assertCanConfirmPickupPaid(order) {
  if (!order.payAtPickup) {
    throw appError("This order is not a pay-at-pickup order", 400);
  }

  if (order.paidStatus === "PAID") {
    throw appError("Order is already marked paid", 400);
  }
}

export function assertCanRecordRefund(order) {
  if (order.status !== "COMPLETED") {
    throw appError("Only completed orders can be refunded", 400);
  }

  if (order.paidStatus !== "PAID") {
    throw appError("Only paid orders can be refunded", 400);
  }
}

export function parseRefundPayload(refund, order) {
  const paidTotal = roundMoney(
    Number(order.cardAmount ?? 0) + Number(order.cashAmount ?? 0),
  );

  if (paidTotal <= 0) {
    throw appError("Order has no paid amount to refund", 400);
  }

  const parsed = parseTenderPayload(refund, paidTotal);
  const origCard = Number(order.cardAmount ?? 0);
  const origCash = Number(order.cashAmount ?? 0);

  if (parsed.cardAmount > origCard) {
    throw appError("Card refund cannot exceed the original card amount", 400);
  }

  if (parsed.cashAmount > origCash) {
    throw appError("Cash refund cannot exceed the original cash amount", 400);
  }

  const refundTotal = roundMoney(parsed.cardAmount + parsed.cashAmount);
  if (refundTotal !== paidTotal) {
    throw appError("Refund must cover the full paid amount", 400);
  }

  return parsed;
}

export function buildRefundEffects(parsed) {
  return {
    paidStatus: "REFUNDED",
    refundTenderType: parsed.method,
    refundedCardAmount: parsed.cardAmount,
    refundedCashAmount: parsed.cashAmount,
  };
}

export function kitchenPaidFilter() {
  return {
    OR: [{ paidStatus: "PAID" }, { payAtPickup: true }],
  };
}

export async function finalizeCheckoutSideEffects(order, effects) {
  if (effects.printReceipt) {
    await safePrintReceipt(order);
  }
}
