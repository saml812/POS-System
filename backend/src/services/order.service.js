import { appError } from "../lib/appError.js";
import { prisma } from "../lib/db.js";
import { getBusinessDate, getNextTicketNumberForShift } from "../lib/shift.js";
import { emitOrderEvent } from "../lib/socket.js";

const userSelect = { id: true, email: true, role: true };

const orderItemsInclude = {
  items: { include: { options: true } },
};

const orderActiveInclude = {
  ...orderItemsInclude,
  placedBy: { select: userSelect },
};

const orderKitchenInclude = orderActiveInclude;

const orderCashierInclude = {
  ...orderActiveInclude,
  finishedBy: { select: userSelect },
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

function withActor(order, actorField, user) {
  return {
    ...order,
    [actorField]: toUserSummary(user),
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

async function transitionOrder(orderId, user, updateFn, eventType, actorField) {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, businessDate: true },
    });
    if (!current) {
      throw appError("Order not found", 404);
    }

    if (current.businessDate !== getBusinessDate()) {
      throw appError("Order not found", 404);
    }

    const updated = await updateFn(tx, current);
    await logTransition(tx, orderId, current.status, updated.status, user.id);
    return actorField ? withActor(updated, actorField, user) : updated;
  });

  const payload = toOrder(order);
  emitOrderEvent(eventType, payload);
  if (eventType !== "order:completed" && eventType !== "order:cancelled") {
    emitOrderEvent("order:updated", payload);
  }

  return payload;
}

export async function createOrder(user, { items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw appError("At least one item is required");
  }

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

    const sizeId =
      typeof entry.sizeId === "string" ? entry.sizeId.trim() || null : null;

    const preferences =
      typeof entry.preferences === "string"
        ? entry.preferences.trim() || null
        : null;

    return { menuItemId, quantity, optionIds, sizeId, preferences };
  });

  const menuItemIds = [...new Set(parsedEntries.map((entry) => entry.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      isAvailable: true,
    },
    select: {
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
    },
  });
  const menuItemById = new Map(menuItems.map((item) => [item.id, item]));

  const lineItems = [];
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

    let selectedSize = null;
    if (entry.sizeId) {
      selectedSize = menuItem.sizes.find((row) => row.id === entry.sizeId);
      if (!selectedSize) {
        throw appError(`Invalid size for ${menuItem.name}: ${entry.sizeId}`);
      }
    } else if (menuItem.sizes.length > 0) {
      throw appError(`A size is required for ${menuItem.name}`);
    }

    const optionTotal = selectedOptions.reduce(
      (sum, option) => sum + Number(option.priceDelta),
      0,
    );
    const sizeTotal = selectedSize ? Number(selectedSize.priceDelta) : 0;
    const unitPrice = Number(menuItem.price) + optionTotal + sizeTotal;

    lineItems.push({
      menuItemId: menuItem.id,
      itemCode: menuItem.itemNumber ?? null,
      name: menuItem.name,
      sizeName: selectedSize ? selectedSize.name : null,
      price: unitPrice,
      quantity: entry.quantity,
      preferences: entry.preferences,
      options: {
        create: selectedOptions.map((option) => ({
          name: option.name,
          priceDelta: option.priceDelta,
        })),
      },
    });
  }

  const businessDate = getBusinessDate();

  const order = await prisma.$transaction(async (tx) => {
    const ticketNumber = await getNextTicketNumberForShift(tx, businessDate);
    const created = await tx.order.create({
      data: {
        ticketNumber,
        businessDate,
        status: "PENDING",
        placedById: user.id,
        items: { create: lineItems },
      },
      include: orderItemsInclude,
      relationLoadStrategy: "join",
    });

    await logTransition(tx, created.id, null, "PENDING", user.id);
    return withActor(created, "placedBy", user);
  });

  const payload = toOrder(order);
  emitOrderEvent("order:created", payload);
  emitOrderEvent("order:updated", payload);
  return payload;
}

function currentShiftWhere(extra = {}) {
  return {
    businessDate: getBusinessDate(),
    ...extra,
  };
}

async function listShiftOrders(statusFilter, include) {
  const orders = await prisma.order.findMany({
    relationLoadStrategy: "join",
    where: currentShiftWhere(statusFilter),
    include,
    orderBy: [{ ticketNumber: "asc" }, { createdAt: "asc" }],
  });

  return orders.map(toOrder);
}

export async function getActiveOrders({ status } = {}) {
  const statusFilter = status ? { status } : { status: { not: "COMPLETED" } };
  return listShiftOrders(statusFilter, orderActiveInclude);
}

export async function getKitchenFeed({ includeVoided = false } = {}) {
  const statuses = includeVoided
    ? ["PENDING", "IN_PROGRESS", "FINISHED", "CANCELLED"]
    : ["PENDING", "IN_PROGRESS", "FINISHED"];

  return listShiftOrders({ status: { in: statuses } }, orderKitchenInclude);
}

export async function getCashierFeed({ includeInProgress = false } = {}) {
  const statuses = includeInProgress
    ? ["IN_PROGRESS", "FINISHED"]
    : ["FINISHED"];

  return listShiftOrders({ status: { in: statuses } }, orderCashierInclude);
}

async function updateOrderStatus(tx, orderId, data, include) {
  return tx.order.update({
    where: { id: orderId },
    data,
    include,
    relationLoadStrategy: "join",
  });
}

export async function startOrder(orderId, user) {
  return transitionOrder(
    orderId,
    user,
    async (tx, order) => {
      if (order.status !== "PENDING") {
        throw appError(`Cannot start order in ${order.status} status`);
      }

      return updateOrderStatus(
        tx,
        order.id,
        { status: "IN_PROGRESS" },
        orderKitchenInclude,
      );
    },
    "order:updated",
    null,
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

      return updateOrderStatus(
        tx,
        order.id,
        {
          status: "FINISHED",
          finishedAt: new Date(),
          finishedById: user.id,
        },
        orderCashierInclude,
      );
    },
    "order:updated",
    "finishedBy",
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

      return updateOrderStatus(
        tx,
        order.id,
        {
          status: "COMPLETED",
          completedAt: new Date(),
          completedById: user.id,
        },
        orderCashierInclude,
      );
    },
    "order:completed",
    "completedBy",
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

      return updateOrderStatus(
        tx,
        order.id,
        {
          status: "CANCELLED",
          previousStatus: order.status,
          cancelReason: reason?.trim() || null,
          cancelledAt: new Date(),
          cancelledById: user.id,
        },
        orderKitchenInclude,
      );
    },
    "order:cancelled",
    "cancelledBy",
  );
}
