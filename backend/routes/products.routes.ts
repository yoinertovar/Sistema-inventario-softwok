import { Router } from "express";
import {
    getProducts,
    createProduct,
    updateProduct,
    adjustStock,
    deleteProduct,
    getCategories,
    createCategory
} from "../controllers/products.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Categorías
router.get("/categories", requireAuth, getCategories);
router.post("/categories", requireAuth, createCategory);

// Productos
router.get("/", requireAuth, getProducts);
router.post("/", requireAuth, createProduct);
router.put("/:id", requireAuth, updateProduct);
router.post("/:id/adjust-stock", requireAuth, adjustStock);
router.delete("/:id", requireAuth, deleteProduct);

export default router;
