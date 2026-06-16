import { Router } from "express";
import {
  createOrder,
  getActiveOrders,
  getOrderByTicket,
  completeOrder,
  cancelOrder,
  startOrder,
  finishOrder,
  confirmPaid,
  reprintReceipt,
  recordRefund,
} from "../controllers/order.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/active", getActiveOrders);
router.get("/by-ticket/:ticketNumber", getOrderByTicket);

router.post("/", allowRoles("CASHIER", "MANAGER"), createOrder);
router.post("/:id/confirm-paid", allowRoles("CASHIER", "MANAGER"), confirmPaid);
router.post("/:id/reprint-receipt", allowRoles("CASHIER", "MANAGER"), reprintReceipt);
router.post("/:id/record-refund", allowRoles("MANAGER"), recordRefund);

router.patch("/:id/complete", allowRoles("CASHIER", "MANAGER"), completeOrder);
router.patch("/:id/start", allowRoles("KITCHEN", "MANAGER"), startOrder);
router.patch("/:id/finish", allowRoles("KITCHEN", "MANAGER"), finishOrder);
router.patch("/:id/cancel", allowRoles("CASHIER", "KITCHEN", "MANAGER"), cancelOrder);

export default router;
