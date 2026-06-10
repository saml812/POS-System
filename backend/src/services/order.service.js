import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getBusinessDate, getNextTicketNumber } from "../lib/tickets.js";
import { emitOrderEvent } from "../lib/socket.js";

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

function toUserSummary(user) {
  return { id: user.id, email: user.email, role: user.role };
}

function toOrder(order) {
  return {
    id: order.id,
    ticketNumber: order.ticketNumber,
    status: order.status,
    previousStatus: order.previousStatus,
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

async function findTodayOrder(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, businessDate: true },
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

async function buildLineItems(items) {
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

export async function createOrder(user, { items }) {
  const lineItems = await buildLineItems(items);
  const businessDate = getBusinessDate();

  const order = await prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumber(tx, businessDate);
    const created = await tx.order.create({
      data: {
        ticketNumber,
        businessDate,
        status: "PENDING",
        placedById: user.id,
        items: { create: lineItems },
      },
      include: ITEMS,
    });

    await logTransition(tx, created.id, null, "PENDING", user.id);
    return withActor(created, "placedBy", user);
  });

  return publishOrder(toOrder(order), "order:created", "order:updated");
}

export async function getActiveOrders({ status } = {}) {
  const statusFilter = status ? { status } : { status: { not: "COMPLETED" } };
  return listToday(statusFilter, include.active);
}

export async function getKitchenFeed({ includeVoided = false } = {}) {
  const statuses = includeVoided
    ? ["PENDING", "IN_PROGRESS", "FINISHED", "CANCELLED"]
    : ["PENDING", "IN_PROGRESS", "FINISHED"];

  return listToday({ status: { in: statuses } }, include.active);
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
