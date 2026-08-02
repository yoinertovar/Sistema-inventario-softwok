import { readJSON, writeJSON } from "./storage.service";
import { ROLES } from "../shared/constants";
import { PERMISSIONS } from "../permissions/PermissionConstants";

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "WORKER";
  permissions: string[];
  active: boolean;
  baseSalary: number; // monthly base salary
  commissionRate: number; // e.g. 0.02 for 2% commission on sales
  phone: string;
  createdAt: string;
}

const USERS_KEY = "softwork_users";

// Default seed users if none exist
const DEFAULT_USERS: User[] = [
  {
    id: "usr-admin",
    name: "Administrador General",
    email: "admin@softwork.co",
    password: "admin",
    role: "ADMIN",
    permissions: Object.values(PERMISSIONS), // Admin gets all permissions
    active: true,
    baseSalary: 2500000, // $2.500.000 COP
    commissionRate: 0,
    phone: "3001234567",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-cajero",
    name: "Carlos Cajero (Vendedor)",
    email: "cajero@softwork.co",
    password: "cajero",
    role: "WORKER",
    permissions: [
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.CREATE_CLIENT,
      PERMISSIONS.EDIT_CLIENT,
      PERMISSIONS.VIEW_CREDITS,
      PERMISSIONS.PROCESS_CREDIT_PAYMENT,
      PERMISSIONS.ACCESS_POS,
      PERMISSIONS.CLOSE_CASH_REGISTER,
      PERMISSIONS.VIEW_SALES_HISTORY,
    ],
    active: true,
    baseSalary: 1300000, // $1.300.000 COP (SMMLV aprox)
    commissionRate: 0.02, // 2% sales commission
    phone: "3119876543",
    createdAt: new Date().toISOString(),
  },
];

/**
 * Gets all users from localStorage.
 */
export const getUsers = (): User[] => {
  const users = readJSON<User[]>(USERS_KEY, []);
  if (users.length === 0) {
    writeJSON(USERS_KEY, DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  return users;
};

/**
 * Persists user array.
 */
export const saveUsers = (users: User[]): void => {
  writeJSON(USERS_KEY, users);
};

/**
 * Creates or updates a user.
 */
export const upsertUser = (user: User): User => {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  
  if (index >= 0) {
    // Preserve password if not specified
    const existing = users[index];
    user.password = user.password || existing.password;
    users[index] = { ...existing, ...user };
  } else {
    // New user
    user.id = user.id || `usr-${Date.now()}`;
    user.createdAt = user.createdAt || new Date().toISOString();
    user.password = user.password || "123456"; // default pwd
    users.push(user);
  }
  
  saveUsers(users);
  return user;
};

/**
 * Deletes a user.
 */
export const deleteUser = (id: string): boolean => {
  const users = getUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length !== users.length) {
    saveUsers(filtered);
    return true;
  }
  return false;
};
