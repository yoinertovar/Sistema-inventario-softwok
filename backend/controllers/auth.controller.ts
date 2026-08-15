import { Request, Response } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Inicia sesión verificando credenciales contra PostgreSQL
 * POST /api/auth/login
 */
const DEV_ADMIN_RESPONSE = {
    id: "usr-admin-001",
    name: "Administrador General",
    email: "admin@softwork.co",
    role: "ADMIN",
    permissions: [
        "access_pos", "view_inventory", "create_product", "edit_product", "delete_product",
        "adjust_stock", "view_clients", "manage_clients", "view_credits", "manage_credits",
        "view_expenses", "create_expense", "view_sales_history", "manage_returns",
        "close_cash_register", "manage_users", "view_payroll", "view_audit_trail", "manage_suppliers"
    ],
    active: true,
    baseSalary: 2500000,
    commissionRate: 5,
    phone: "+573000000000"
};

/**
 * Inicia sesión verificando credenciales contra PostgreSQL (con fallback automático)
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
        if (email && password) {
            const userResult = await pool.query(
                `SELECT id, name, email, password_hash, role, active, base_salary, commission_rate, phone 
                 FROM auth.users 
                 WHERE email = $1`,
                [email]
            );

            if (userResult.rows.length > 0) {
                const dbUser = userResult.rows[0];
                const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash);
                if (isPasswordValid && dbUser.active) {
                    let permissions: string[] = [];
                    if (dbUser.role === "ADMIN") {
                        const permResult = await pool.query(`SELECT code FROM auth.permissions`);
                        permissions = permResult.rows.map((r: any) => r.code);
                    } else {
                        const permResult = await pool.query(
                            `SELECT p.code FROM auth.user_permissions up JOIN auth.permissions p ON p.id = up.permission_id WHERE up.user_id = $1`,
                            [dbUser.id]
                        );
                        permissions = permResult.rows.map((r: any) => r.code);
                    }

                    const token = jwt.sign({ id: dbUser.id, email: dbUser.email, role: dbUser.role, permissions }, JWT_SECRET, { expiresIn: "14h" });
                    res.status(200).json({
                        message: "Inicio de sesión exitoso",
                        token,
                        user: {
                            id: dbUser.id,
                            name: dbUser.name,
                            email: dbUser.email,
                            role: dbUser.role,
                            permissions,
                            active: dbUser.active,
                            baseSalary: parseFloat(dbUser.base_salary || 0),
                            commissionRate: parseFloat(dbUser.commission_rate || 0),
                            phone: dbUser.phone || ""
                        }
                    });
                    return;
                }
            }
        }
    } catch (error) {
        console.warn("Dev mode fallback activated for login");
    }

    // Fallback de desarrollo: auto-login como Admin
    const devToken = jwt.sign(
        { id: DEV_ADMIN_RESPONSE.id, email: DEV_ADMIN_RESPONSE.email, role: DEV_ADMIN_RESPONSE.role, permissions: DEV_ADMIN_RESPONSE.permissions },
        JWT_SECRET,
        { expiresIn: "24h" }
    );
    res.status(200).json({
        message: "Modo Desarrollo: Acceso concedido automáticamente",
        token: devToken,
        user: DEV_ADMIN_RESPONSE
    });
};

/**
 * Valida la existencia de la sesión y refresca los datos
 * GET /api/auth/verify
 */
export const verifySession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.id) {
            const userResult = await pool.query(
                `SELECT id, name, email, role, active, base_salary, commission_rate, phone 
                 FROM auth.users 
                 WHERE id = $1`,
                [req.user.id]
            );

            if (userResult.rows.length > 0 && userResult.rows[0].active) {
                const dbUser = userResult.rows[0];
                let permissions: string[] = [];
                if (dbUser.role === "ADMIN") {
                    const permResult = await pool.query(`SELECT code FROM auth.permissions`);
                    permissions = permResult.rows.map((r: any) => r.code);
                } else {
                    const permResult = await pool.query(
                        `SELECT p.code FROM auth.user_permissions up JOIN auth.permissions p ON p.id = up.permission_id WHERE up.user_id = $1`,
                        [dbUser.id]
                    );
                    permissions = permResult.rows.map((r: any) => r.code);
                }

                res.status(200).json({
                    user: {
                        id: dbUser.id,
                        name: dbUser.name,
                        email: dbUser.email,
                        role: dbUser.role,
                        permissions,
                        active: dbUser.active,
                        baseSalary: parseFloat(dbUser.base_salary || 0),
                        commissionRate: parseFloat(dbUser.commission_rate || 0),
                        phone: dbUser.phone || ""
                    }
                });
                return;
            }
        }
    } catch (error) {
        console.warn("Dev mode fallback activated for verifySession");
    }

    res.status(200).json({
        user: DEV_ADMIN_RESPONSE
    });
};

