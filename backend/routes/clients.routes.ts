import { Router } from "express";
import {
    getClients,
    createClient,
    updateClient,
    processCreditPayment,
    getClientCreditHistory
} from "../controllers/clients.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getClients);
router.post("/", requireAuth, createClient);
router.put("/:id", requireAuth, updateClient);
router.post("/:id/credit-payment", requireAuth, processCreditPayment);
router.get("/:id/credit-history", requireAuth, getClientCreditHistory);

export default router;
