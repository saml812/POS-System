import { Router } from "express";
import {
  createOrder,
  getActiveOrders,
  completeOrder,
  cancelOrder,
  startOrder,
  finishOrder,
} from "../controllers/order.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/active", getActiveOrders);

router.post("/", allowRoles("CASHIER", "MANAGER"), createOrder);

router.patch("/:id/complete", allowRoles("CASHIER", "MANAGER"), completeOrder);
router.patch("/:id/start", allowRoles("KITCHEN", "MANAGER"), startOrder);
router.patch("/:id/finish", allowRoles("KITCHEN", "MANAGER"), finishOrder);
router.patch("/:id/cancel", allowRoles("CASHIER", "KITCHEN", "MANAGER"), cancelOrder);

export default router;
