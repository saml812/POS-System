import { Router } from "express";
import {
  getSettings,
  resetTicketReset,
  updateTicketReset,
} from "../controllers/settings.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.use(requireAuth, managerOnly);

router.get("/", getSettings);
router.patch("/ticket-reset", updateTicketReset);
router.post("/ticket-reset/reset", resetTicketReset);

export default router;
