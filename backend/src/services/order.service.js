import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getBusinessDate, getNextTicketNumber } from "../lib/tickets.js";
import { emitOrderEvent } from "../lib/socket.js";
import * as checkoutService from "./checkout.service.js";
import { printCustomerReceipt } from "./receipt.service.js";

const ACTOR = { id: true, email: true, role: true };
const ITEMS = { items: { include: { options: true } } };

const include = {
  active: {
    ...ITEMS,
    placedBy: { select: ACTOR },
    refundedBy: { select: ACTOR },
  },
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

function unpaidPickupFilter() {
  return {
    status: { notIn: ["COMPLETED", "CANCELLED"] },
    payAtPickup: true,
    paidStatus: "UNPAID",
  };
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
    tenderType: order.tenderType ?? null,
    paidStatus: order.paidStatus ?? "UNPAID",
    cardAmount: order.cardAmount != null ? Number(order.cardAmount) : null,
    cashAmount: order.cashAmount != null ? Number(order.cashAmount) : null,
    refundTenderType: order.refundTenderType ?? null,
    refundedCardAmount:
      order.refundedCardAmount != null ? Number(order.refundedCardAmount) : null,
    refundedCashAmount:
      order.refundedCashAmount != null ? Number(order.refundedCashAmount) : null,
    refundedAt: order.refundedAt ?? null,
    refundedBy: order.refundedBy ?? null,
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

async function loadOrderForCheckout(orderId) {
  return findTodayOrder(prisma, orderId, {
    ...ITEMS,
    placedBy: { select: ACTOR },
  });
}

function paidUpdateFromEffects(effects) {
  const data = {};

  if (effects.tenderType !== undefined) data.tenderType = effects.tenderType;
  if (effects.paidStatus !== undefined) data.paidStatus = effects.paidStatus;
  if (effects.cardAmount !== undefined) data.cardAmount = effects.cardAmount;
  if (effects.cashAmount !== undefined) data.cashAmount = effects.cashAmount;

  return data;
}

async function persistCheckoutEffects(order, effects) {
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: paidUpdateFromEffects(effects),
    include: { ...ITEMS, placedBy: { select: ACTOR } },
  });

  await checkoutService.finalizeCheckoutSideEffects(updated, effects);
  return updated;
}

export async function createOrder(user, body) {
  const { items, tender, payAtPickup } = body ?? {};
  const lineItems = await buildLineItems(items);
  const total = checkoutService.computeItemsTotal(lineItems);
  const businessDate = getBusinessDate();
  const isCallIn = Boolean(payAtPickup);

  if (isCallIn && tender) {
    throw appError("Tender cannot be provided for pay-at-pickup orders");
  }

  if (!isCallIn && !tender) {
    throw appError("Tender is required for walk-in orders");
  }

  const parsedTender = isCallIn
    ? null
    : checkoutService.parseTenderPayload(tender, total);

  let created = await prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumber(tx, businessDate);
    const order = await tx.order.create({
      data: {
        ticketNumber,
        businessDate,
        status: "PENDING",
        placedById: user.id,
        payAtPickup: isCallIn,
        paidStatus: "UNPAID",
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
    const effects = checkoutService.buildPaidEffects(parsedTender);
    created = await persistCheckoutEffects(created, effects);
    const payload = toOrder(created);
    return publishOrder(payload, "order:created", "order:updated");
  } catch (err) {
    await prisma.order.delete({ where: { id: created.id } }).catch(() => undefined);
    throw err;
  }
}

export async function confirmPaid(orderId, user, tender) {
  const order = await loadOrderForCheckout(orderId);
  const total = checkoutService.computeItemsTotal(order.items);

  checkoutService.assertCanConfirmPickupPaid(order);
  const parsed = checkoutService.parseTenderPayload(tender, total);
  const effects = checkoutService.buildPaidEffects(parsed);

  const updated = await persistCheckoutEffects(order, effects);
  return publishOrder(toOrder(updated), "order:updated");
}

export async function reprintReceipt(orderId) {
  const order = await loadOrderForCheckout(orderId);

  if (order.paidStatus !== "PAID") {
    throw appError("Receipt can only be printed for paid orders", 400);
  }

  await printCustomerReceipt(order);
  return { printed: true, order: toOrder(order) };
}

export async function getOrderByTicket(ticketNumber) {
  const num = Number(ticketNumber);
  if (!Number.isInteger(num) || num < 1) {
    throw appError("Invalid ticket number", 400);
  }

  const order = await prisma.order.findUnique({
    where: {
      businessDate_ticketNumber: {
        businessDate: getBusinessDate(),
        ticketNumber: num,
      },
    },
    include: include.active,
  });

  if (!order) {
    throw appError("Order not found", 404);
  }

  return toOrder(order);
}

export async function recordRefund(orderId, user, refund) {
  const order = await loadOrderForCheckout(orderId);

  checkoutService.assertCanRecordRefund(order);
  const parsed = checkoutService.parseRefundPayload(refund, order);
  const effects = checkoutService.buildRefundEffects(parsed);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      ...effects,
      refundedAt: new Date(),
      refundedById: user.id,
    },
    include: include.active,
  });

  const payload = toOrder({
    ...updated,
    refundedBy: toUserSummary(user),
  });

  return publishOrder(payload, "order:updated");
}

export async function getActiveOrders({ status, awaitingPaid } = {}) {
  let statusFilter;

  if (awaitingPaid) {
    statusFilter = unpaidPickupFilter();
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
      ...checkoutService.kitchenPaidFilter(),
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

      if (order.paidStatus !== "PAID") {
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
