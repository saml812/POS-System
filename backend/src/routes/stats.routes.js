import { Router } from "express";
import {
  archiveOrders,
  exportOrdersCsv,
  getSalesSummary,
} from "../controllers/stats.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.get("/sales", requireAuth, getSalesSummary);
router.get("/export", requireAuth, managerOnly, exportOrdersCsv);
router.post("/archive", requireAuth, managerOnly, archiveOrders);

export default router;
