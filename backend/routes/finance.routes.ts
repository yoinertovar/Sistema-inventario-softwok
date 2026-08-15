import { Router } from "express";
import {
    getExpenses,
    createExpense,
    createCashClosure,
    getCashClosures,
    getAuditLogs
} from "../controllers/finance.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Gastos
router.get("/expenses", requireAuth, getExpenses);
router.post("/expenses", requireAuth, createExpense);

// Cierre de Caja
router.get("/cash-closures", requireAuth, getCashClosures);
router.post("/cash-closures", requireAuth, createCashClosure);

// Auditoría
router.get("/audit-logs", requireAuth, getAuditLogs);

export default router;
