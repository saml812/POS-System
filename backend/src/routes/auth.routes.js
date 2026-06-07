import { Router } from "express";
import { getStatus, login, logout, getMe } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/status", getStatus);
router.post("/login", login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getMe);

export default router;
