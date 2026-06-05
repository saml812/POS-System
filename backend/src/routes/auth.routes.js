import { Router } from "express";

const router = Router();

router.get("/auth/status", (req, res) => {
  if (req.isAuthenticated?.() && req.user) {
    const { id, email, role } = req.user;
    return res.json({
      authenticated: true,
      user: { id, email, role },
    });
  }

  res.json({ authenticated: false });
});

export default router;


