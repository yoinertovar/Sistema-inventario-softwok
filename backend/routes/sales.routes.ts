import { Router } from "express";
import { createSale, getSalesHistory, getSaleDetails } from "../controllers/sales.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getSalesHistory);
router.post("/", requireAuth, createSale);
router.get("/:id", requireAuth, getSaleDetails);

export default router;
