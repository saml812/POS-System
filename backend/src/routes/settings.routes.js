import { Router } from "express";
import {
  getSettings,
  updateTicketReset,
  updateReceiptSettings,
  testReceiptPrinter,
} from "../controllers/settings.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.use(requireAuth, managerOnly);

router.get("/", getSettings);
router.patch("/ticket-reset", updateTicketReset);
router.patch("/receipt", updateReceiptSettings);
router.post("/receipt/test", testReceiptPrinter);

export default router;
