import { Router } from "express";
import {
  createOrder,
  getActiveOrders,
  completeOrder,
  cancelOrder,
  startOrder,
  finishOrder,
  collectPayment,
  confirmOrderCash,
  retryPayment,
  refundOrder,
  voidCardPortion,
} from "../controllers/order.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/active", getActiveOrders);

router.post("/", allowRoles("CASHIER", "MANAGER"), createOrder);
router.post("/:id/collect-payment", allowRoles("CASHIER", "MANAGER"), collectPayment);
router.post("/:id/confirm-cash", allowRoles("CASHIER", "MANAGER"), confirmOrderCash);
router.post("/:id/retry-payment", allowRoles("CASHIER", "MANAGER"), retryPayment);
router.post("/:id/void-card", allowRoles("CASHIER", "MANAGER"), voidCardPortion);
router.post("/:id/refund", allowRoles("MANAGER"), refundOrder);

router.patch("/:id/complete", allowRoles("CASHIER", "MANAGER"), completeOrder);
router.patch("/:id/start", allowRoles("KITCHEN", "MANAGER"), startOrder);
router.patch("/:id/finish", allowRoles("KITCHEN", "MANAGER"), finishOrder);
router.patch("/:id/cancel", allowRoles("CASHIER", "KITCHEN", "MANAGER"), cancelOrder);

export default router;
