import { readJSON, writeJSON } from "./storage.service";
import { addAuditLog } from "./auditLog.service";

export interface Client {
  id: string;
  name: string;
  nitOrCc: string; // ID Card or NIT
  phone: string;
  email: string;
  address: string;
  creditLimit: number; // Max amount they can borrow
  creditBalance: number; // Current debt they owe us
  active: boolean;
  createdAt: string;
}

const CLIENTS_KEY = "softwork_clients";

const DEFAULT_CLIENTS: Client[] = [
  {
    id: "cli-consumidor",
    name: "Consumidor Final (Público General)",
    nitOrCc: "222222222222",
    phone: "N/A",
    email: "consumidor@softwork.co",
    address: "Ventas de Mostrador",
    creditLimit: 0,
    creditBalance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cli-juan",
    name: "Juan Fernando Pérez",
    nitOrCc: "1015432876",
    phone: "3154448899",
    email: "juan.perez@gmail.com",
    address: "Calle 100 # 15 - 89, Bogotá",
    creditLimit: 800000, // $800.000 limit
    creditBalance: 155000, // owes $155.000
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cli-distribuidora",
    name: "Comercializadora DistriNorte S.A.S.",
    nitOrCc: "900.555.123-4",
    phone: "3206781234",
    email: "facturacion@distrinorte.co",
    address: "Zona Industrial Alamos, Bodega 4",
    creditLimit: 4000000,
    creditBalance: 1250000,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cli-maria",
    name: "María Camila Gómez",
    nitOrCc: "52432876",
    phone: "3182223344",
    email: "camila.gomez@yahoo.com",
    address: "Carrera 7 # 45 - 20, Apt 502",
    creditLimit: 300000,
    creditBalance: 0, // perfect record
    active: true,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Gets all clients.
 */
export const getClients = (): Client[] => {
  const clients = readJSON<Client[]>(CLIENTS_KEY, []);
  if (clients.length === 0) {
    writeJSON(CLIENTS_KEY, DEFAULT_CLIENTS);
    return DEFAULT_CLIENTS;
  }
  return clients;
};

/**
 * Saves all clients.
 */
export const saveClients = (clients: Client[]): void => {
  writeJSON(CLIENTS_KEY, clients);
};

/**
 * Creates or updates a client.
 */
export const upsertClient = (client: Client): Client => {
  const clients = getClients();
  const index = clients.findIndex((c) => c.id === client.id);

  if (index >= 0) {
    const prev = clients[index];
    clients[index] = { ...clients[index], ...client };

    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador / Operador",
      userRole: "ADMIN",
      category: "USER_MANAGEMENT",
      severity: "INFO",
      action: "ACTUALIZAR_CLIENTE",
      entityId: client.id,
      entityName: client.name,
      details: `Información del cliente "${client.name}" (${client.nitOrCc}) actualizada (Límite Crédito: $${client.creditLimit.toLocaleString("es-CO")}).`,
      previousState: `Límite: $${prev.creditLimit} COP`,
      newState: `Límite: $${client.creditLimit} COP`
    });
  } else {
    client.id = client.id || `cli-${Date.now()}`;
    client.createdAt = client.createdAt || new Date().toISOString();
    clients.push(client);

    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador / Operador",
      userRole: "ADMIN",
      category: "USER_MANAGEMENT",
      severity: "INFO",
      action: "CREAR_CLIENTE",
      entityId: client.id,
      entityName: client.name,
      details: `Nuevo cliente comercial "${client.name}" (NIT/CC: ${client.nitOrCc}) registrado.`,
      newState: "Cliente Creado"
    });
  }

  saveClients(clients);
  return client;
};

/**
 * Deletes a client.
 */
export const deleteClient = (id: string): boolean => {
  if (id === "cli-consumidor") return false; // cannot delete general public
  const clients = getClients();
  const targetClient = clients.find((c) => c.id === id);
  const filtered = clients.filter((c) => c.id !== id);

  if (filtered.length !== clients.length) {
    saveClients(filtered);

    // Critical Audit Log for Client Deletion
    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador General",
      userRole: "ADMIN",
      category: "ENTRY_DELETE",
      severity: "CRITICAL",
      action: "ELIMINAR_CLIENTE",
      entityId: id,
      entityName: targetClient?.name || `Cliente ${id}`,
      details: `Eliminación permanente del registro de cliente "${targetClient?.name || id}" (NIT/CC: ${targetClient?.nitOrCc}).`,
      previousState: targetClient ? `Cliente: ${targetClient.name} (${targetClient.nitOrCc})` : undefined,
      newState: "Registro Eliminado"
    });

    return true;
  }
  return false;
};
