import * as orderService from "../services/order.service.js";

export async function getKitchenFeed(req, res, next) {
  try {
    const includeVoided = req.query.includeVoided === "true";
    const orders = await orderService.getKitchenFeed({ includeVoided });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
}
