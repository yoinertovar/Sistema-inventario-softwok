import { Router } from "express";
import { getSuppliers, createSupplier, recordPurchase } from "../controllers/suppliers.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getSuppliers);
router.post("/", requireAuth, createSupplier);
router.post("/purchases", requireAuth, recordPurchase);

export default router;
