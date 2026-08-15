import { readJSON, writeJSON, removeJSON } from "./storage.service";

const CURRENT_USER_KEY = "softwork_current_user";
const JWT_TOKEN_KEY = "softwork_token";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "WORKER";
  permissions: string[];
  active: boolean;
  baseSalary: number;
  commissionRate: number;
  phone: string;
}

/**
 * Helper para obtener el token JWT y adjuntarlo a futuras peticiones API
 */
export const getToken = (): string | null => {
  return localStorage.getItem(JWT_TOKEN_KEY);
};

/**
 * Inicia sesión contra el nuevo backend PostgreSQL (Express)
 */
export const login = async (email: string, password: string): Promise<UserSession> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Error al iniciar sesión.");
  }

  // Guardamos el token real
  localStorage.setItem(JWT_TOKEN_KEY, data.token);
  // Guardamos la sesión (mantiene compatibilidad de sistema JSON en transición)
  writeJSON(CURRENT_USER_KEY, data.user);

  return data.user;
};

/**
 * Limpia completamente la sesión local
 */
export const logout = (): void => {
  localStorage.removeItem(JWT_TOKEN_KEY);
  removeJSON(CURRENT_USER_KEY);
};

const DEV_DEFAULT_USER: UserSession = {
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
 * Recupera el usuario desde la caché local sin hacer peticiones (Síncrono/Rápido)
 */
export const getCurrentUser = (): UserSession | null => {
  return readJSON<UserSession | null>(CURRENT_USER_KEY, DEV_DEFAULT_USER);
};

/**
 * Verifica la validez del JWT contra el Backend. 
 * Si el token expiró, la base de datos lo rechazará.
 */
export const verifyToken = async (): Promise<UserSession | null> => {
  const token = getToken();
  const current = getCurrentUser();

  try {
    const res = await fetch("/api/auth/verify", {
      headers: {
        "Authorization": `Bearer ${token || "dev-token"}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const updatedSession = data.user || DEV_DEFAULT_USER;
      if (JSON.stringify(updatedSession) !== JSON.stringify(current)) {
        writeJSON(CURRENT_USER_KEY, updatedSession);
      }
      return updatedSession;
    }
  } catch (error) {
    console.warn("Dev mode auth verify fallback");
  }

  const fallback = current || DEV_DEFAULT_USER;
  writeJSON(CURRENT_USER_KEY, fallback);
  return fallback;
};

/**
 * Configuración en caliente local de propiedades (ej: update temporal UX)
 */
export const updateSessionUser = (userData: Partial<UserSession>): void => {
  const current = getCurrentUser();
  if (current && current.id === userData.id) {
    const updated = { ...current, ...userData };
    writeJSON(CURRENT_USER_KEY, updated);
  }
};
