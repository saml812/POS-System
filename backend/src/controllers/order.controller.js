import { asyncHandler } from "../middleware/asyncHandler.js";
import * as orderService from "../services/order.service.js";

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user, req.body);
  res.status(201).json({ order });
});

export const getActiveOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getActiveOrders(
    req.query.status ? { status: req.query.status } : {},
  );
  res.json({ orders });
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
