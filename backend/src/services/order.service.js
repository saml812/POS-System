import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { localizedName, parseLocale } from "../lib/menuLocale.js";
import { getNextTicketNumber } from "../lib/shift.js";
import { emitOrderEvent } from "../lib/socket.js";

const orderInclude = {
  items: { include: { options: true } },
  placedBy: { select: { id: true, email: true, role: true } },
  cancelledBy: { select: { id: true, email: true, role: true } },
  finishedBy: { select: { id: true, email: true, role: true } },
  completedBy: { select: { id: true, email: true, role: true } },
};

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

async function logTransition(tx, orderId, fromStatus, toStatus, userId) {
  await tx.orderStatusLog.create({
    data: {
      orderId,
      fromStatus,
      toStatus,
      changedById: userId,
    },
  });
}

async function transitionOrder(orderId, user, updateFn, eventType) {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current) {
      throw appError("Order not found", 404);
    }

    const updated = await updateFn(tx, current);
    await logTransition(tx, orderId, current.status, updated.status, user.id);
    return updated;
  });

  const payload = toOrder(order);
  emitOrderEvent(eventType, payload);
  if (eventType !== "order:completed" && eventType !== "order:cancelled") {
    emitOrderEvent("order:updated", payload);
  }

  return payload;
}

export async function createOrder(user, { items, locale: localeInput }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw appError("At least one item is required");
  }

  const locale = parseLocale(localeInput);

  const order = await prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumber(tx);
    const lineItems = [];
    const parsedEntries = items.map((entry) => {
      const menuItemId = entry.menuItemId?.trim();
      const quantity = Number(entry.quantity ?? 1);

      if (!menuItemId) {
        throw appError("Each item requires a menuItemId");
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw appError("quantity must be a positive integer");
      }

      const optionIds = Array.isArray(entry.optionIds)
        ? [...new Set(entry.optionIds.map((id) => String(id).trim()).filter(Boolean))]
        : [];

      const preferences =
        typeof entry.preferences === "string"
          ? entry.preferences.trim() || null
          : null;

      return { menuItemId, quantity, optionIds, preferences };
    });

    const menuItemIds = [...new Set(parsedEntries.map((entry) => entry.menuItemId))];
    const menuItems = await tx.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
      },
      include: {
        options: {
          where: { isAvailable: true },
        },
      },
    });
    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));

    for (const entry of parsedEntries) {
      const menuItem = menuItemById.get(entry.menuItemId);
      if (!menuItem) {
        throw appError(`Menu item not available: ${entry.menuItemId}`);
      }

      const selectedOptions = [];
      for (const optionId of entry.optionIds) {
        const option = menuItem.options.find((row) => row.id === optionId);
        if (!option) {
          throw appError(`Invalid option for ${menuItem.name}: ${optionId}`);
        }
        selectedOptions.push(option);
      }

      const optionTotal = selectedOptions.reduce(
        (sum, option) => sum + Number(option.priceDelta),
        0,
      );
      const unitPrice = Number(menuItem.price) + optionTotal;

      lineItems.push({
        menuItemId: menuItem.id,
        itemCode: menuItem.itemNumber ?? null,
        name: localizedName(menuItem, locale),
        price: unitPrice,
        quantity: entry.quantity,
        preferences: entry.preferences,
        options: {
          create: selectedOptions.map((option) => ({
            name: localizedName(option, locale),
            priceDelta: option.priceDelta,
          })),
        },
      });
    }

    const created = await tx.order.create({
      data: {
        ticketNumber,
        status: "PENDING",
        placedById: user.id,
        items: { create: lineItems },
      },
      include: orderInclude,
    });

    await logTransition(tx, created.id, null, "PENDING", user.id);
    return created;
  });

  const payload = toOrder(order);
  emitOrderEvent("order:created", payload);
  emitOrderEvent("order:updated", payload);
  return payload;
}

export async function getActiveOrders({ status } = {}) {
  const where = status ? { status } : { status: { not: "COMPLETED" } };

  const orders = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "asc" },
  });

  return orders.map(toOrder);
}

export async function getKitchenFeed({ includeVoided = false } = {}) {
  const statuses = includeVoided
    ? ["PENDING", "IN_PROGRESS", "FINISHED", "CANCELLED"]
    : ["PENDING", "IN_PROGRESS", "FINISHED"];

  const orders = await prisma.order.findMany({
    where: { status: { in: statuses } },
    include: orderInclude,
    orderBy: { createdAt: "asc" },
  });

  return orders.map(toOrder);
}

export async function getCashierFeed({ includeInProgress = false } = {}) {
  const statuses = includeInProgress
    ? ["IN_PROGRESS", "FINISHED"]
    : ["FINISHED"];

  const orders = await prisma.order.findMany({
    where: { status: { in: statuses } },
    include: orderInclude,
    orderBy: { createdAt: "asc" },
  });

  return orders.map(toOrder);
}

export async function startOrder(orderId, user) {
  return transitionOrder(
    orderId,
    user,
    async (tx, order) => {
      if (order.status !== "PENDING") {
        throw appError(`Cannot start order in ${order.status} status`);
      }

      return tx.order.update({
        where: { id: order.id },
        data: { status: "IN_PROGRESS" },
        include: orderInclude,
      });
    },
    "order:updated"
  );
}

export async function finishOrder(orderId, user) {
  return transitionOrder(
    orderId,
    user,
    async (tx, order) => {
      if (order.status !== "IN_PROGRESS") {
        throw appError(`Cannot finish order in ${order.status} status`);
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "FINISHED",
          finishedAt: new Date(),
          finishedById: user.id,
        },
        include: orderInclude,
      });
    },
    "order:updated"
  );
}

export async function completeOrder(orderId, user) {
  return transitionOrder(
    orderId,
    user,
    async (tx, order) => {
      if (order.status !== "FINISHED") {
        throw appError(`Cannot complete order in ${order.status} status`);
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedById: user.id,
        },
        include: orderInclude,
      });
    },
    "order:completed"
  );
}

export async function cancelOrder(orderId, user, { reason } = {}) {
  return transitionOrder(
    orderId,
    user,
    async (tx, order) => {
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw appError(`Cannot cancel order in ${order.status} status`);
      }

      if (user.role === "CASHIER" && order.status !== "PENDING") {
        throw appError("Cashiers can only cancel PENDING orders");
      }

      if (user.role === "KITCHEN" && !["PENDING", "IN_PROGRESS"].includes(order.status)) {
        throw appError("Kitchen can only cancel PENDING or IN_PROGRESS orders");
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          previousStatus: order.status,
          cancelReason: reason?.trim() || null,
          cancelledAt: new Date(),
          cancelledById: user.id,
        },
        include: orderInclude,
      });
    },
    "order:cancelled"
  );
}
