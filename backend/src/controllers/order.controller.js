import * as orderService from "../services/order.service.js";

export async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder(req.user, req.body);
    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
}

export async function getActiveOrders(req, res, next) {
  try {
    const status = req.query.status;
    const orders = await orderService.getActiveOrders(
      status ? { status } : {},
    );
    res.json({ orders });
  } catch (error) {
    next(error);
  }
}

export async function getKitchenFeed(req, res, next) {
  try {
    const includeVoided = req.query.includeVoided === "true";
    const orders = await orderService.getKitchenFeed({ includeVoided });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
}

export async function getCashierFeed(req, res, next) {
  try {
    const includeInProgress = req.query.includeInProgress === "true";
    const orders = await orderService.getCashierFeed({ includeInProgress });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
}

export async function completeOrder(req, res, next) {
  try {
    const order = await orderService.completeOrder(req.params.id, req.user);
    res.json({ order });
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user, req.body);
    res.json({ order });
  } catch (error) {
    next(error);
  }
}

export async function startOrder(req, res, next) {
  try {
    const order = await orderService.startOrder(req.params.id, req.user);
    res.json({ order });
  } catch (error) {
    next(error);
  }
}

export async function finishOrder(req, res, next) {
  try {
    const order = await orderService.finishOrder(req.params.id, req.user);
    res.json({ order });
  } catch (error) {
    next(error);
  }
}
