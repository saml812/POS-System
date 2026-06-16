import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getBusinessDate, getNextTicketNumber } from "../lib/tickets.js";
import { emitOrderEvent } from "../lib/socket.js";
import * as paymentService from "./payment.service.js";

const ACTOR = { id: true, email: true, role: true };
const ITEMS = { items: { include: { options: true } } };

const include = {
  active: { ...ITEMS, placedBy: { select: ACTOR } },
  cashier: {
    ...ITEMS,
    placedBy: { select: ACTOR },
    finishedBy: { select: ACTOR },
  },
};

const menuItemSelect = {
  id: true,
  itemNumber: true,
  name: true,
  price: true,
  options: {
    where: { isAvailable: true },
    select: { id: true, name: true, priceDelta: true },
  },
  sizes: {
    where: { isAvailable: true },
    select: { id: true, name: true, priceDelta: true },
  },
};

const STALE_PROCESSING_MS = 5 * 60 * 1000;

function paymentNeedsActionFilter() {
  return {
    status: { notIn: ["COMPLETED", "CANCELLED"] },
    OR: [
      { paymentStatus: "FAILED" },
      { paymentStatus: "PROCESSING" },
      { payAtPickup: true, paymentStatus: "UNPAID" },
      {
        paymentMethod: "SPLIT",
        paymentStatus: "UNPAID",
        cardAmount: { gt: 0 },
      },
    ],
  };
}

async function recoverStaleProcessing(order) {
  if (order.paymentStatus !== "PROCESSING") {
    return order;
  }

  const age = Date.now() - new Date(order.updatedAt).getTime();
  if (age < STALE_PROCESSING_MS) {
    throw appError("Payment is already in progress", 409);
  }

  console.error(
    "[payment] stale PROCESSING recovered",
    order.id,
    order.ticketNumber,
  );

  return prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "FAILED",
      paymentError: "Payment timed out. Please retry.",
    },
    include: { ...ITEMS, placedBy: { select: ACTOR } },
  });
}

async function prepareOrderForPayment(order) {
  if (order.paymentStatus !== "PROCESSING") {
    return order;
  }

  return recoverStaleProcessing(order);
}

async function safePersistPaymentEffects(order, effects) {
  try {
    return await persistPaymentEffects(order, effects);
  } catch (persistErr) {
    console.error(
      "[payment] persist failed after terminal; saving payment fields",
      order.id,
      persistErr.message,
    );

    try {
      const partial = await prisma.order.update({
        where: { id: order.id },
        data: paymentUpdateFromEffects(effects),
        include: { ...ITEMS, placedBy: { select: ACTOR } },
      });
      await paymentService.finalizePaymentSideEffects(partial, effects);
      return partial;
    } catch (retryErr) {
      console.error(
        "[payment] critical: payment captured but DB save failed",
        order.id,
        retryErr.message,
      );
      throw persistErr;
    }
  }
}

function toUserSummary(user) {
  return { id: user.id, email: user.email, role: user.role };
}

function toOrder(order) {
  return {
    id: order.id,
    ticketNumber: order.ticketNumber,
    businessDate: order.businessDate,
    status: order.status,
    previousStatus: order.previousStatus,
    payAtPickup: order.payAtPickup ?? false,
    paymentMethod: order.paymentMethod ?? null,
    paymentStatus: order.paymentStatus ?? "UNPAID",
    cardAmount: order.cardAmount != null ? Number(order.cardAmount) : null,
    cashAmount: order.cashAmount != null ? Number(order.cashAmount) : null,
    paymentAuthCode: order.paymentAuthCode ?? null,
    paymentError: order.paymentError ?? null,
    cancelReason: order.cancelReason,
    cancelledAt: order.cancelledAt,
    cancelledBy: order.cancelledBy ?? null,
    finishedAt: order.finishedAt,
    finishedBy: order.finishedBy ?? null,
    completedAt: order.completedAt,
    completedBy: order.completedBy ?? null,
    placedBy: order.placedBy,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      itemCode: item.itemCode ?? null,
      name: item.name,
      sizeName: item.sizeName ?? null,
      price: Number(item.price),
      quantity: item.quantity,
      preferences: item.preferences ?? null,
      options: (item.options ?? []).map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: Number(option.priceDelta),
      })),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function withActor(order, field, user) {
  return { ...order, [field]: toUserSummary(user) };
}

function publishOrder(payload, ...events) {
  for (const event of events) {
    emitOrderEvent(event, payload);
  }
  return payload;
}

function requireStatus(order, status, action) {
  if (order.status !== status) {
    throw appError(`Cannot ${action} order in ${order.status} status`);
  }
}

async function logTransition(tx, orderId, fromStatus, toStatus, userId) {
  await tx.orderStatusLog.create({
    data: { orderId, fromStatus, toStatus, changedById: userId },
  });
}

async function findTodayOrder(tx, orderId, includeRelations = null) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: includeRelations,
  });

  if (!order || order.businessDate !== getBusinessDate()) {
    throw appError("Order not found", 404);
  }

  return order;
}

async function updateOrder(tx, orderId, data, relationInclude) {
  return tx.order.update({
    where: { id: orderId },
    data,
    include: relationInclude,
  });
}

async function runTransition(orderId, user, { apply, event, actorField }) {
  const order = await prisma.$transaction(async (tx) => {
    const current = await findTodayOrder(tx, orderId);
    const updated = await apply(tx, current);
    await logTransition(tx, orderId, current.status, updated.status, user.id);
    return actorField ? withActor(updated, actorField, user) : updated;
  });

  const payload = toOrder(order);
  const events =
    event === "order:completed" || event === "order:cancelled"
      ? [event]
      : [event, "order:updated"];

  return publishOrder(payload, ...events);
}

function parseItemEntry(entry) {
  const menuItemId = entry.menuItemId?.trim();
  const quantity = Number(entry.quantity ?? 1);

  if (!menuItemId) {
    throw appError("Each item requires a menuItemId");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw appError("quantity must be a positive integer");
  }

  return {
    menuItemId,
    quantity,
    optionIds: Array.isArray(entry.optionIds)
      ? [...new Set(entry.optionIds.map((id) => String(id).trim()).filter(Boolean))]
      : [],
    sizeId: typeof entry.sizeId === "string" ? entry.sizeId.trim() || null : null,
    preferences:
      typeof entry.preferences === "string"
        ? entry.preferences.trim() || null
        : null,
  };
}

function pickOptions(menuItem, optionIds) {
  return optionIds.map((optionId) => {
    const option = menuItem.options.find((row) => row.id === optionId);
    if (!option) {
      throw appError(`Invalid option for ${menuItem.name}: ${optionId}`);
    }
    return option;
  });
}

function pickSize(menuItem, sizeId) {
  if (sizeId) {
    const size = menuItem.sizes.find((row) => row.id === sizeId);
    if (!size) {
      throw appError(`Invalid size for ${menuItem.name}: ${sizeId}`);
    }
    return size;
  }

  if (menuItem.sizes.length > 0) {
    throw appError(`A size is required for ${menuItem.name}`);
  }

  return null;
}

function buildLineItem(menuItem, entry) {
  const selectedOptions = pickOptions(menuItem, entry.optionIds);
  const selectedSize = pickSize(menuItem, entry.sizeId);
  const optionTotal = selectedOptions.reduce(
    (sum, option) => sum + Number(option.priceDelta),
    0,
  );
  const sizeTotal = selectedSize ? Number(selectedSize.priceDelta) : 0;

  return {
    menuItemId: menuItem.id,
    itemCode: menuItem.itemNumber ?? null,
    name: menuItem.name,
    sizeName: selectedSize?.name ?? null,
    price: Number(menuItem.price) + optionTotal + sizeTotal,
    quantity: entry.quantity,
    preferences: entry.preferences,
    options: {
      create: selectedOptions.map((option) => ({
        name: option.name,
        priceDelta: option.priceDelta,
      })),
    },
  };
}

export async function buildLineItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw appError("At least one item is required");
  }

  const entries = items.map(parseItemEntry);
  const menuItemIds = [...new Set(entries.map((entry) => entry.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, isAvailable: true },
    select: menuItemSelect,
  });
  const menuItemById = new Map(menuItems.map((item) => [item.id, item]));

  return entries.map((entry) => {
    const menuItem = menuItemById.get(entry.menuItemId);
    if (!menuItem) {
      throw appError(`Menu item not available: ${entry.menuItemId}`);
    }
    return buildLineItem(menuItem, entry);
  });
}

async function listToday(statusFilter, relationInclude) {
  const orders = await prisma.order.findMany({
    where: { businessDate: getBusinessDate(), ...statusFilter },
    include: relationInclude,
    orderBy: [{ ticketNumber: "asc" }, { createdAt: "asc" }],
  });

  return orders.map(toOrder);
}

function assertCanCancel(order, user) {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw appError(`Cannot cancel order in ${order.status} status`);
  }

  if (order.paymentStatus === "PROCESSING") {
    throw appError("Cannot cancel while payment is processing");
  }

  if (user.role === "CASHIER" && order.status !== "PENDING") {
    throw appError("Cashiers can only cancel PENDING orders");
  }

  if (
    user.role === "KITCHEN" &&
    !["PENDING", "IN_PROGRESS"].includes(order.status)
  ) {
    throw appError("Kitchen can only cancel PENDING or IN_PROGRESS orders");
  }
}

async function loadOrderForPayment(orderId) {
  return findTodayOrder(prisma, orderId, {
    ...ITEMS,
    placedBy: { select: ACTOR },
  });
}

function paymentUpdateFromEffects(effects) {
  const data = {};

  if (effects.paymentMethod !== undefined) data.paymentMethod = effects.paymentMethod;
  if (effects.paymentStatus !== undefined) data.paymentStatus = effects.paymentStatus;
  if (effects.cardAmount !== undefined) data.cardAmount = effects.cardAmount;
  if (effects.cashAmount !== undefined) data.cashAmount = effects.cashAmount;
  if (effects.paymentError !== undefined) data.paymentError = effects.paymentError;
  if (effects.paymentRefNo !== undefined) data.paymentRefNo = effects.paymentRefNo;
  if (effects.paymentAuthCode !== undefined) data.paymentAuthCode = effects.paymentAuthCode;
  if (effects.paymentRecordNo !== undefined) data.paymentRecordNo = effects.paymentRecordNo;
  if (effects.paymentAcqRefData !== undefined) data.paymentAcqRefData = effects.paymentAcqRefData;
  if (effects.paymentProcess !== undefined) data.paymentProcess = effects.paymentProcess;
  if (effects.paymentAttemptCount !== undefined) {
    data.paymentAttemptCount = effects.paymentAttemptCount;
  }

  return data;
}

async function persistPaymentEffects(order, effects) {
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: paymentUpdateFromEffects(effects),
    include: { ...ITEMS, placedBy: { select: ACTOR } },
  });

  await paymentService.finalizePaymentSideEffects(updated, effects);
  return updated;
}

async function markPaymentFailed(orderId, message) {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "FAILED",
      paymentError: message ?? "Payment failed",
    },
  });
}

function isTerminalBusyError(err) {
  return err?.statusCode === 409 && /terminal is busy/i.test(err.message ?? "");
}

async function runCardPayment(order, payment, total, { onSuccess }) {
  paymentService.parsePaymentPayload(payment, total);

  const previousStatus = order.paymentStatus;

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PROCESSING", paymentError: null },
  });

  try {
    const effects = await paymentService.applyWalkInPayment(order, payment, total);
    const updated = await safePersistPaymentEffects(order, effects);
    return onSuccess(updated, effects);
  } catch (err) {
    if (isTerminalBusyError(err)) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: previousStatus, paymentError: err.message },
      });
    } else {
      await markPaymentFailed(order.id, err.message);
    }
    throw err;
  }
}

export async function createOrder(user, body) {
  const { items, payment, payAtPickup } = body ?? {};
  const lineItems = await buildLineItems(items);
  const total = paymentService.computeItemsTotal(lineItems);
  const businessDate = getBusinessDate();
  const isCallIn = Boolean(payAtPickup);

  if (isCallIn && payment) {
    throw appError("Payment cannot be provided for pay-at-pickup orders");
  }

  if (!isCallIn && !payment) {
    throw appError("Payment is required for walk-in orders");
  }

  let created = await prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumber(tx, businessDate);
    const order = await tx.order.create({
      data: {
        ticketNumber,
        businessDate,
        status: "PENDING",
        placedById: user.id,
        payAtPickup: isCallIn,
        paymentStatus: isCallIn ? "UNPAID" : "PROCESSING",
        items: { create: lineItems },
      },
      include: ITEMS,
    });

    await logTransition(tx, order.id, null, "PENDING", user.id);
    return withActor(order, "placedBy", user);
  });

  if (isCallIn) {
    return publishOrder(toOrder(created), "order:created", "order:updated");
  }

  try {
    const effects = await paymentService.applyWalkInPayment(created, payment, total);
    created = await safePersistPaymentEffects(created, effects);
    const payload = toOrder(created);

    if (effects.emitKitchen) {
      return publishOrder(payload, "order:created", "order:updated");
    }

    return publishOrder(payload, "order:updated");
  } catch (err) {
    await markPaymentFailed(created.id, err.message);
    throw err;
  }
}

export async function collectPayment(orderId, user, payment) {
  let order = await loadOrderForPayment(orderId);
  order = await prepareOrderForPayment(order);
  const total = paymentService.computeItemsTotal(order.items);

  paymentService.assertCanCollectPayment(order);

  return runCardPayment(order, payment, total, {
    onSuccess: async (updated) =>
      publishOrder(toOrder(updated), "order:updated"),
  });
}

export async function confirmOrderCash(orderId, user) {
  const order = await loadOrderForPayment(orderId);

  if (order.status === "CANCELLED" || order.status === "COMPLETED") {
    throw appError("Cannot confirm cash for this order", 400);
  }

  const effects = await paymentService.confirmSplitCash(order);
  const updated = await persistPaymentEffects(order, effects);
  const payload = toOrder(updated);

  if (effects.emitKitchen && order.paymentStatus !== "AUTHORIZED") {
    return publishOrder(payload, "order:created", "order:updated");
  }

  return publishOrder(payload, "order:updated");
}

export async function retryPayment(orderId, user, payment) {
  let order = await loadOrderForPayment(orderId);
  order = await prepareOrderForPayment(order);

  if (!["FAILED", "UNPAID"].includes(order.paymentStatus)) {
    throw appError("Payment cannot be retried in current state", 400);
  }

  if (paymentService.isSplitAwaitingCash(order)) {
    throw appError(
      "Split payment awaiting cash confirmation; use confirm-cash or void-card",
      400,
    );
  }

  if (order.payAtPickup) {
    return collectPayment(orderId, user, payment);
  }

  const total = paymentService.computeItemsTotal(order.items);

  return runCardPayment(order, payment, total, {
    onSuccess: async (updated, effects) => {
      const payload = toOrder(updated);

      if (effects.emitKitchen) {
        return publishOrder(payload, "order:created", "order:updated");
      }

      return publishOrder(payload, "order:updated");
    },
  });
}

export async function voidCardPortion(orderId, user) {
  const order = await loadOrderForPayment(orderId);

  if (order.status === "CANCELLED" || order.status === "COMPLETED") {
    throw appError("Cannot void card payment for this order", 400);
  }

  if (!paymentService.isSplitAwaitingCash(order)) {
    throw appError("No authorized card portion to void", 400);
  }

  const effects = await paymentService.voidCardPortion(order);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: paymentUpdateFromEffects(effects),
    include: { ...ITEMS, placedBy: { select: ACTOR } },
  });

  return publishOrder(toOrder(updated), "order:updated");
}

export async function refundOrder(orderId, user) {
  const order = await loadOrderForPayment(orderId);

  if (order.status !== "COMPLETED") {
    throw appError("Only completed orders can be refunded", 400);
  }

  const effects = await paymentService.refundCardPayment(order);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: effects.paymentStatus,
      paymentAttemptCount: effects.paymentAttemptCount,
    },
    include: { ...ITEMS, placedBy: { select: ACTOR } },
  });

  return publishOrder(toOrder(updated), "order:updated");
}

export async function getActiveOrders({ status, needsPayment } = {}) {
  let statusFilter;

  if (needsPayment) {
    statusFilter = paymentNeedsActionFilter();
  } else if (status) {
    statusFilter = { status };
  } else {
    statusFilter = { status: { not: "COMPLETED" } };
  }

  return listToday(statusFilter, include.active);
}

export async function getKitchenFeed({ includeVoided = false } = {}) {
  const statuses = includeVoided
    ? ["PENDING", "IN_PROGRESS", "FINISHED", "CANCELLED"]
    : ["PENDING", "IN_PROGRESS", "FINISHED"];

  return listToday(
    {
      status: { in: statuses },
      ...paymentService.kitchenPaymentFilter(),
    },
    include.active,
  );
}

export async function getCashierFeed({ includeInProgress = false } = {}) {
  const statuses = includeInProgress
    ? ["IN_PROGRESS", "FINISHED"]
    : ["FINISHED"];

  return listToday({ status: { in: statuses } }, include.cashier);
}

export async function startOrder(orderId, user) {
  return runTransition(orderId, user, {
    event: "order:updated",
    apply: async (tx, order) => {
      requireStatus(order, "PENDING", "start");
      return updateOrder(tx, order.id, { status: "IN_PROGRESS" }, include.active);
    },
  });
}

export async function finishOrder(orderId, user) {
  return runTransition(orderId, user, {
    event: "order:updated",
    actorField: "finishedBy",
    apply: async (tx, order) => {
      requireStatus(order, "IN_PROGRESS", "finish");
      return updateOrder(
        tx,
        order.id,
        {
          status: "FINISHED",
          finishedAt: new Date(),
          finishedById: user.id,
        },
        include.cashier,
      );
    },
  });
}

export async function completeOrder(orderId, user) {
  return runTransition(orderId, user, {
    event: "order:completed",
    actorField: "completedBy",
    apply: async (tx, order) => {
      requireStatus(order, "FINISHED", "complete");

      if (order.paymentStatus !== "AUTHORIZED") {
        throw appError("Order must be paid before completing", 400);
      }

      return updateOrder(
        tx,
        order.id,
        {
          status: "COMPLETED",
          completedAt: new Date(),
          completedById: user.id,
        },
        include.cashier,
      );
    },
  });
}

export async function cancelOrder(orderId, user, { reason } = {}) {
  const full = await loadOrderForPayment(orderId);
  assertCanCancel(full, user);

  const hasCard =
    full.cardAmount &&
    Number(full.cardAmount) > 0 &&
    (full.paymentStatus === "AUTHORIZED" ||
      (full.paymentStatus === "UNPAID" && full.paymentMethod === "SPLIT"));

  if (hasCard) {
    const voidEffects = await paymentService.voidCardPayment(full);
    if (voidEffects.voided) {
      await prisma.order.update({
        where: { id: full.id },
        data: {
          paymentStatus: voidEffects.paymentStatus,
          paymentAttemptCount: voidEffects.paymentAttemptCount,
        },
      });
    }
  }

  return runTransition(orderId, user, {
    event: "order:cancelled",
    actorField: "cancelledBy",
    apply: async (tx, order) => {
      assertCanCancel(order, user);
      return updateOrder(
        tx,
        order.id,
        {
          status: "CANCELLED",
          previousStatus: order.status,
          cancelReason: reason?.trim() || null,
          cancelledAt: new Date(),
          cancelledById: user.id,
        },
        include.active,
      );
    },
  });
}
