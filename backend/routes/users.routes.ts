import { Router } from "express";
import { getUsers, createUser, updateUser, deleteUser } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, getUsers);
router.post("/", requireAuth, requireRole(["ADMIN"]), createUser);
router.put("/:id", requireAuth, requireRole(["ADMIN"]), updateUser);
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteUser);

export default router;
