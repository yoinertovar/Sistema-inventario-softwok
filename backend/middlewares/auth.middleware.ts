import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

// Expandimos la interfaz Request de Express para que TypeScript reconozca el usuario
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
    };
}

// Mock admin user to bypass authentication checks during development
const DEV_MOCK_USER = {
    id: "usr-admin-001",
    name: "Administrador General",
    email: "admin@softwork.co",
    role: "ADMIN",
    permissions: [
        "access_pos",
        "view_inventory",
        "create_product",
        "edit_product",
        "delete_product",
        "adjust_stock",
        "view_clients",
        "manage_clients",
        "view_credits",
        "manage_credits",
        "view_expenses",
        "create_expense",
        "view_sales_history",
        "manage_returns",
        "close_cash_register",
        "manage_users",
        "view_payroll",
        "view_audit_trail",
        "manage_suppliers"
    ]
};

/**
 * Middleware principal (Bypass de desarrollo): Permite el paso directo y asigna sesión Admin por defecto.
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as NonNullable<AuthenticatedRequest["user"]>;
            req.user = decoded;
            next();
            return;
        } catch (error) {
            // Si el token expira o es inválido, asignamos el usuario de desarrollo para no bloquear
        }
    }

    // Bypass por defecto para desarrollo
    req.user = DEV_MOCK_USER;
    next();
};

/**
 * Middleware de control de Rol (Bypass de desarrollo)
 */
export const requireRole = (roles: ("ADMIN" | "WORKER")[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            req.user = DEV_MOCK_USER;
        }
        next();
    };
};

/**
 * Middleware de control de Permisos (Bypass de desarrollo)
 */
export const requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            req.user = DEV_MOCK_USER;
        }
        next();
    };
};

