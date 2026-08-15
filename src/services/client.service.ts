import { readJSON, writeJSON } from "./storage.service";
import { getToken } from "./auth.service";

export interface Client {
  id: string;
  name: string;
  nitOrCc: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  creditBalance: number;
  active: boolean;
  isDefault?: boolean;
  createdAt: string;
}

const CLIENTS_KEY = "softwork_clients";

/**
 * Consultar clientes desde PostgreSQL
 */
export const fetchClients = async (): Promise<Client[]> => {
  try {
    const res = await fetch("/api/clients", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      writeJSON(CLIENTS_KEY, data);
      return data;
    }
  } catch (error) {
    console.warn("Fallo de red al consultar clientes en PG:", error);
  }
  return readJSON<Client[]>(CLIENTS_KEY, []);
};

/**
 * Crear o actualizar cliente en PostgreSQL
 */
export const upsertClient = async (client: Partial<Client> & { id?: string }): Promise<Client> => {
  const isUpdate = !!client.id && !client.id.startsWith("cli-");
  const url = isUpdate ? `/api/clients/${client.id}` : "/api/clients";
  const method = isUpdate ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      name: client.name,
      nitOrCc: client.nitOrCc,
      phone: client.phone,
      email: client.email,
      address: client.address,
      creditLimit: client.creditLimit,
      active: client.active ?? true
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al guardar cliente en la base de datos.");
  }

  await fetchClients();
  return data.client;
};

/**
 * Eliminar / Desactivar cliente
 */
export const deleteClient = (id: string): boolean => {
  if (id === "cli-consumidor") return false;
  const clients = getClients();
  const filtered = clients.filter((c) => c.id !== id);
  if (filtered.length !== clients.length) {
    saveClients(filtered);
    deleteClientApi(id).catch(console.error);
    return true;
  }
  return false;
};

export const deleteClientApi = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ active: false })
    });
    if (res.ok) {
      await fetchClients();
      return true;
    }
  } catch (error) {
    console.error("Error al desactivar cliente en PG:", error);
  }
  return false;
};

/**
 * Registrar abono a crédito en PostgreSQL
 */
export const processCreditPayment = async (clientId: string, amount: number, paymentMethod: string = "CASH", notes?: string): Promise<void> => {
  const res = await fetch(`/api/clients/${clientId}/credit-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ amount, paymentMethod, notes })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Error al registrar el abono a crédito.");
  }

  await fetchClients();
};

export const getClients = (): Client[] => readJSON<Client[]>(CLIENTS_KEY, []);
export const saveClients = (clients: Client[]): void => writeJSON(CLIENTS_KEY, clients);
