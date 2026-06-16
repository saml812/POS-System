import { appError } from "../lib/appError.js";
import { withTerminalLock } from "../lib/terminalMutex.js";
import * as datacap from "./datacap.service.js";
import { printCustomerReceipt } from "./receipt.service.js";

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function computeItemsTotal(items) {
  return roundMoney(
    items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
  );
}

export function parsePaymentPayload(payment, total) {
  if (!payment || typeof payment !== "object") {
    throw appError("Payment is required for walk-in orders");
  }

  const method = String(payment.method ?? "").toUpperCase();
  if (!["CASH", "CARD", "SPLIT"].includes(method)) {
    throw appError("Invalid payment method");
  }

  if (method === "CASH") {
    if (payment.cardAmount !== undefined && payment.cardAmount !== null) {
      throw appError("cardAmount is not allowed for cash payment");
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

  const cardAmount = roundMoney(payment.cardAmount);
  if (!Number.isFinite(cardAmount) || cardAmount <= 0 || cardAmount >= total) {
    throw appError("Split card amount must be between 0 and order total");
  }

  return {
    method: "SPLIT",
    cardAmount,
    cashAmount: roundMoney(total - cardAmount),
  };
}

export function isSplitAwaitingCash(order) {
  return (
    order.paymentMethod === "SPLIT" &&
    order.paymentStatus === "UNPAID" &&
    Number(order.cardAmount) > 0
  );
}

export function assertNotSplitAwaitingCash(order) {
  if (isSplitAwaitingCash(order)) {
    throw appError(
      "Card portion is already authorized; confirm cash or void the card payment first",
      400,
    );
  }
}

function nextRefNo(order) {
  const attempt = (order.paymentAttemptCount ?? 0) + 1;
  return `${order.id.slice(-8)}-${attempt}`;
}

async function runCardCapture(order, cardAmount) {
  const refNo = nextRefNo(order);
  const result = await withTerminalLock(() =>
    datacap.runSale({
      orderId: order.id,
      ticketNumber: order.ticketNumber,
      refNo,
      amount: cardAmount,
    }),
  );

  return {
    refNo: result.refNo ?? refNo,
    authCode: result.authCode,
    recordNo: result.recordNo,
    acqRefData: result.acqRefData,
    process: result.process,
    attemptIncrement: 1,
  };
}

async function safePrintReceipt(order) {
  try {
    await withTerminalLock(() => printCustomerReceipt(order));
  } catch (err) {
    console.error("[receipt] print failed", order.id, err.message);
  }
}

export async function applyWalkInPayment(order, payment, total) {
  assertNotSplitAwaitingCash(order);
  const parsed = parsePaymentPayload(payment, total);

  if (parsed.method === "CASH") {
    return {
      paymentMethod: "CASH",
      paymentStatus: "AUTHORIZED",
      cardAmount: 0,
      cashAmount: parsed.cashAmount,
      paymentError: null,
      printReceipt: true,
      emitKitchen: true,
    };
  }

  if (parsed.method === "CARD") {
    const capture = await runCardCapture(order, parsed.cardAmount);
    return {
      paymentMethod: "CARD",
      paymentStatus: "AUTHORIZED",
      cardAmount: parsed.cardAmount,
      cashAmount: 0,
      paymentRefNo: capture.refNo,
      paymentAuthCode: capture.authCode,
      paymentRecordNo: capture.recordNo,
      paymentAcqRefData: capture.acqRefData,
      paymentProcess: capture.process,
      paymentAttemptCount: (order.paymentAttemptCount ?? 0) + capture.attemptIncrement,
      paymentError: null,
      printReceipt: true,
      emitKitchen: true,
    };
  }

  const capture = await runCardCapture(order, parsed.cardAmount);
  return {
    paymentMethod: "SPLIT",
    paymentStatus: "UNPAID",
    cardAmount: parsed.cardAmount,
    cashAmount: parsed.cashAmount,
    paymentRefNo: capture.refNo,
    paymentAuthCode: capture.authCode,
    paymentRecordNo: capture.recordNo,
    paymentAcqRefData: capture.acqRefData,
    paymentProcess: capture.process,
    paymentAttemptCount: (order.paymentAttemptCount ?? 0) + capture.attemptIncrement,
    paymentError: null,
    printReceipt: false,
    emitKitchen: false,
  };
}

export function assertCanCollectPayment(order) {
  if (!order.payAtPickup) {
    throw appError("This order is not a pay-at-pickup order", 400);
  }

  if (order.paymentStatus === "AUTHORIZED") {
    throw appError("Order is already paid", 400);
  }

  if (order.paymentStatus === "PROCESSING") {
    throw appError("Payment is already in progress", 409);
  }
}

export async function applyCollectPayment(order, payment, total) {
  assertCanCollectPayment(order);
  const result = await applyWalkInPayment(order, payment, total);

  if (result.paymentStatus === "UNPAID" && result.paymentMethod === "SPLIT") {
    return result;
  }

  result.emitKitchen = false;
  return result;
}

export async function confirmSplitCash(order) {
  if (order.paymentMethod !== "SPLIT") {
    throw appError("Cash confirmation is only for split payments", 400);
  }

  if (order.paymentStatus !== "UNPAID") {
    throw appError("Split cash cannot be confirmed in current payment state", 400);
  }

  if (!order.cardAmount || Number(order.cardAmount) <= 0) {
    throw appError("Card portion must be authorized before confirming cash", 400);
  }

  const total = computeItemsTotal(order.items);
  const cashAmount = roundMoney(total - Number(order.cardAmount));

  return {
    paymentStatus: "AUTHORIZED",
    cashAmount,
    paymentError: null,
    printReceipt: true,
    emitKitchen: true,
  };
}

export async function voidCardPayment(order) {
  if (!order.cardAmount || Number(order.cardAmount) <= 0) {
    return { voided: false };
  }

  if (order.paymentStatus !== "AUTHORIZED" && order.paymentStatus !== "UNPAID") {
    throw appError("Cannot void payment in current state", 400);
  }

  const refNo = nextRefNo(order);
  await withTerminalLock(() => datacap.runVoidSale(order, refNo));

  return {
    voided: true,
    paymentStatus: "VOIDED",
    paymentAttemptCount: (order.paymentAttemptCount ?? 0) + 1,
  };
}

export async function refundCardPayment(order) {
  if (!order.cardAmount || Number(order.cardAmount) <= 0) {
    throw appError("No card payment to refund", 400);
  }

  if (order.paymentStatus !== "AUTHORIZED") {
    throw appError("Only authorized orders can be refunded", 400);
  }

  const refNo = nextRefNo(order);
  await withTerminalLock(() => datacap.runReturn(order, refNo));

  return {
    paymentStatus: "REFUNDED",
    paymentAttemptCount: (order.paymentAttemptCount ?? 0) + 1,
  };
}

export async function voidCardPortion(order) {
  if (!order.cardAmount || Number(order.cardAmount) <= 0) {
    throw appError("No card payment to void", 400);
  }

  if (!["UNPAID", "FAILED"].includes(order.paymentStatus)) {
    throw appError("Card payment cannot be voided in current state", 400);
  }

  const voidResult = await voidCardPayment(order);

  return {
    paymentMethod: null,
    paymentStatus: order.payAtPickup ? "UNPAID" : "FAILED",
    cardAmount: null,
    cashAmount: null,
    paymentRefNo: null,
    paymentAuthCode: null,
    paymentRecordNo: null,
    paymentAcqRefData: null,
    paymentProcess: null,
    paymentError: null,
    paymentAttemptCount: voidResult.paymentAttemptCount,
    emitKitchen: false,
    printReceipt: false,
  };
}

export function kitchenPaymentFilter() {
  return {
    OR: [{ paymentStatus: "AUTHORIZED" }, { payAtPickup: true }],
  };
}

export async function finalizePaymentSideEffects(order, effects) {
  if (effects.printReceipt) {
    await safePrintReceipt(order);
  }
}
