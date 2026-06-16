import { Router } from "express";
import {
  getSettings,
  updateTicketReset,
  updatePaymentSettings,
  testTerminal,
  testReceiptPrinter,
} from "../controllers/settings.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.use(requireAuth, managerOnly);

router.get("/", getSettings);
router.patch("/ticket-reset", updateTicketReset);
router.patch("/payment", updatePaymentSettings);
router.post("/payment/test-terminal", testTerminal);
router.post("/payment/test-receipt", testReceiptPrinter);

export default router;
