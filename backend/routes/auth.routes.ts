import { Router } from "express";
import { login, verifySession } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Ruta pública para iniciar sesión
router.post("/login", login);

// Ruta protegida para que el frontend valide y refresque su sesión en tiempo real
router.get("/verify", requireAuth, verifySession);

export default router;
