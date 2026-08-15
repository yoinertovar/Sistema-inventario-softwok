import { readJSON, writeJSON } from "./storage.service";
import { getToken } from "./auth.service";

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "WORKER";
  permissions: string[];
  active: boolean;
  baseSalary: number;
  commissionRate: number;
  phone: string;
  createdAt: string;
}

const USERS_KEY = "softwork_users";

/**
 * Obtener todos los usuarios desde la base de datos PostgreSQL
 */
export const fetchUsers = async (): Promise<User[]> => {
  try {
    const res = await fetch("/api/users", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      writeJSON(USERS_KEY, data);
      return data;
    }
  } catch (error) {
    console.warn("Fallo al obtener usuarios desde PG:", error);
  }
  return readJSON<User[]>(USERS_KEY, []);
};

/**
 * Crear o actualizar usuario en PostgreSQL
 */
export const upsertUser = async (user: Partial<User> & { id?: string }): Promise<User> => {
  const isUpdate = !!user.id && !user.id.startsWith("usr-");
  const url = isUpdate ? `/api/users/${user.id}` : "/api/users";
  const method = isUpdate ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      active: user.active ?? true,
      baseSalary: user.baseSalary,
      commissionRate: user.commissionRate,
      phone: user.phone,
      permissions: user.permissions
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al guardar el usuario en PostgreSQL.");
  }

  await fetchUsers();
  return data.user;
};

/**
 * Desactivar o eliminar usuario en PostgreSQL
 */
export const deleteUser = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      await fetchUsers();
      return true;
    }
  } catch (error) {
    console.error("Error al eliminar usuario en PG:", error);
  }
  return false;
};

export const getUsers = (): User[] => readJSON<User[]>(USERS_KEY, []);
export const saveUsers = (users: User[]): void => writeJSON(USERS_KEY, users);
