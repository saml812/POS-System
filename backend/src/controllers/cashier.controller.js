import * as orderService from "../services/order.service.js";

export async function getCashierFeed(req, res, next) {
  try {
    const includeInProgress = req.query.includeInProgress === "true";
    const orders = await orderService.getCashierFeed({ includeInProgress });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
}
