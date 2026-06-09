import { Router } from "express";
import {
  getSettings,
  updateTicketReset,
} from "../controllers/settings.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.use(requireAuth, managerOnly);

router.get("/", getSettings);
router.patch("/ticket-reset", updateTicketReset);

export default router;
