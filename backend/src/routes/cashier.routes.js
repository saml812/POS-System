import { Router } from "express";
import { getCashierFeed } from "../controllers/cashier.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/feed", allowRoles("CASHIER", "MANAGER"), getCashierFeed);

export default router;
