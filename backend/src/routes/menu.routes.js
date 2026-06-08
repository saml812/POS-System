import { Router } from "express";
import {
  getMenu,
  getMenuAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem,
  createItemOption,
  updateItemOption,
  deleteItemOption,
} from "../controllers/menu.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.use(requireAuth);

router.get("/", getMenu);
router.get("/admin", getMenuAdmin);
router.post("/categories", managerOnly, createCategory);
router.patch("/categories/:id", managerOnly, updateCategory);
router.delete("/categories/:id", managerOnly, deleteCategory);

router.post("/items", managerOnly, createItem);
router.patch("/items/:id", managerOnly, updateItem);
router.delete("/items/:id", managerOnly, deleteItem);

router.post("/items/:itemId/options", managerOnly, createItemOption);
router.patch("/options/:id", managerOnly, updateItemOption);
router.delete("/options/:id", managerOnly, deleteItemOption);

export default router;