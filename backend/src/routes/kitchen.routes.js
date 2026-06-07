import { Router } from "express";
import { getKitchenFeed } from "../controllers/kitchen.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/feed", allowRoles("KITCHEN", "MANAGER"), getKitchenFeed);

export default router;
