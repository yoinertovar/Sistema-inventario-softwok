import { readJSON, writeJSON, removeJSON } from "./storage.service";
import { getUsers, User } from "./user.service";

const CURRENT_USER_KEY = "softwork_current_user";

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
 * Logs in a user by verifying email and password.
 */
export const login = async (email: string, password: string): Promise<UserSession> => {
  // Simulate network delay for premium UX loader
  await new Promise((resolve) => setTimeout(resolve, 600));

  const users = getUsers();
  const foundUser = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!foundUser) {
    throw new Error("Credenciales inválidas. Por favor verifique correo y contraseña.");
  }

  if (!foundUser.active) {
    throw new Error("Esta cuenta de usuario ha sido desactivada por el administrador.");
  }

  // Create session object (exclude password for security)
  const sessionUser: UserSession = {
    id: foundUser.id,
    name: foundUser.name,
    email: foundUser.email,
    role: foundUser.role,
    permissions: foundUser.permissions,
    active: foundUser.active,
    baseSalary: foundUser.baseSalary,
    commissionRate: foundUser.commissionRate,
    phone: foundUser.phone,
  };

  writeJSON(CURRENT_USER_KEY, sessionUser);
  return sessionUser;
};

/**
 * Logs out the current user and clears session state.
 */
export const logout = (): void => {
  removeJSON(CURRENT_USER_KEY);
};

/**
 * Retrieves the currently logged in user session.
 */
export const getCurrentUser = (): UserSession | null => {
  return readJSON<UserSession | null>(CURRENT_USER_KEY, null);
};

/**
 * Checks if the current session is valid.
 */
export const verifyToken = async (): Promise<UserSession | null> => {
  const current = getCurrentUser();
  if (!current) return null;

  // Double check user still exists and is active
  const users = getUsers();
  const matched = users.find((u) => u.id === current.id);
  
  if (!matched || !matched.active) {
    logout();
    return null;
  }

  // Update session to reflect latest changes from the database (e.g. updated permissions)
  const updatedSession: UserSession = {
    ...current,
    name: matched.name,
    email: matched.email,
    role: matched.role,
    permissions: matched.permissions || [],
    active: matched.active,
    baseSalary: matched.baseSalary,
    commissionRate: matched.commissionRate,
    phone: matched.phone,
  };
  
  writeJSON(CURRENT_USER_KEY, updatedSession);
  return updatedSession;
};

/**
 * Synchronizes the active session if the admin changes user settings.
 */
export const updateSessionUser = (userData: Partial<UserSession>): void => {
  const current = getCurrentUser();
  if (current && current.id === userData.id) {
    const updated = { ...current, ...userData };
    writeJSON(CURRENT_USER_KEY, updated);
  }
};
