import { asyncHandler } from "../middleware/asyncHandler.js";
import * as orderService from "../services/order.service.js";

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user, req.body);
  res.status(201).json({ order });
});

export const getActiveOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getActiveOrders({
    status: req.query.status,
    awaitingPaid: req.query.awaitingPaid === "true",
  });
  res.json({ orders });
});

export const getOrderByTicket = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderByTicket(req.params.ticketNumber);
  res.json({ order });
});

export const getKitchenFeed = asyncHandler(async (req, res) => {
  const orders = await orderService.getKitchenFeed({
    includeVoided: req.query.includeVoided === "true",
  });
  res.json({ orders });
});

export const getCashierFeed = asyncHandler(async (req, res) => {
  const orders = await orderService.getCashierFeed({
    includeInProgress: req.query.includeInProgress === "true",
  });
  res.json({ orders });
});

export const completeOrder = asyncHandler(async (req, res) => {
  const order = await orderService.completeOrder(req.params.id, req.user);
  res.json({ order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.params.id, req.user, req.body);
  res.json({ order });
});

export const startOrder = asyncHandler(async (req, res) => {
  const order = await orderService.startOrder(req.params.id, req.user);
  res.json({ order });
});

export const finishOrder = asyncHandler(async (req, res) => {
  const order = await orderService.finishOrder(req.params.id, req.user);
  res.json({ order });
});

export const confirmPaid = asyncHandler(async (req, res) => {
  const order = await orderService.confirmPaid(
    req.params.id,
    req.user,
    req.body?.tender ?? req.body,
  );
  res.json({ order });
});

export const reprintReceipt = asyncHandler(async (req, res) => {
  const result = await orderService.reprintReceipt(req.params.id);
  res.json(result);
});

export const recordRefund = asyncHandler(async (req, res) => {
  const order = await orderService.recordRefund(
    req.params.id,
    req.user,
    req.body?.refund ?? req.body,
  );
  res.json({ order });
});
