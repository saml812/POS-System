import { Router } from "express";
import {
  getMenu,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listItems,
  createItem,
  updateItem,
  deleteItem,
} from "../controllers/menu.controller.js";
import { requireAuth, allowRoles } from "../middleware/auth.middleware.js";

const router = Router();
const managerOnly = allowRoles("MANAGER");

router.use(requireAuth);

router.get("/", getMenu);
router.get("/categories", listCategories);
router.post("/categories", managerOnly, createCategory);
router.patch("/categories/:id", managerOnly, updateCategory);
router.delete("/categories/:id", managerOnly, deleteCategory);

router.get("/items", listItems);
router.post("/items", managerOnly, createItem);
router.patch("/items/:id", managerOnly, updateItem);
router.delete("/items/:id", managerOnly, deleteItem);

export default router;