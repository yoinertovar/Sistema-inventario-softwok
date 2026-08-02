import { readJSON, writeJSON } from "./storage.service";
import { bulkAdjustStock } from "./product.service";
import { getClients, saveClients, Client } from "./client.service";
import { addAuditLog } from "./auditLog.service";

// Interfaces
export interface InvoiceItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  total: number;
}

export interface Invoice {
  id: string; // FV-1001, etc.
  client: {
    id: string;
    name: string;
    nitOrCc: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentMethod: "CASH" | "CARD" | "NEQUI_DAVIPLATA" | "CREDIT";
  status: "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED";
  sellerId: string;
  sellerName: string;
  createdAt: string;
  receivedAmount: number;
  changeAmount: number;
}

export interface RefundItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  reason: string;
}

export interface Refund {
  id: string; // REF-1001
  invoiceId: string;
  items: RefundItem[];
  totalRefunded: number;
  createdAt: string;
  restocked: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  nit: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  qty: number;
  purchasePrice: number;
  total: number;
}

export interface PurchaseInvoice {
  id: string; // FC-1001
  invoiceNumber: string; // Supplier's invoice number
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  createdAt: string;
}

export interface Expense {
  id: string; // G-1001
  category: "Arriendo" | "Servicios Públicos" | "Nómina" | "Papelería" | "Mantenimiento" | "Otros";
  description: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  createdAt: string;
}

export interface CashCountBill {
  denomination: number;
  qty: number;
}

export interface CashRegisterClosure {
  id: string;
  closedBy: string;
  closedByName: string;
  openedAt: string;
  closedAt: string;
  
  // System values
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  electronicSales: number; // nequi daviplata
  creditSales: number;
  totalSales: number;
  cashExpenses: number;
  expectedCashInBox: number;
  
  // Counted values
  countedCash: number;
  countedCard: number;
  countedElectronic: number;
  
  // Discrepancy
  cashDiscrepancy: number; // positive = surplus, negative = shortage
  observations: string;
  status: "COMPLETED";
}

// Storage Keys
const INVOICES_KEY = "softwork_invoices";
const REFUNDS_KEY = "softwork_refunds";
const SUPPLIERS_KEY = "softwork_suppliers";
const PURCHASES_KEY = "softwork_purchases";
const EXPENSES_KEY = "softwork_expenses";
const CASH_CLOSURES_KEY = "softwork_cash_closures";

// Default Suppliers
const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: "sup-1", name: "Alquería de Colombia S.A.", nit: "860.005.432-1", phone: "3104561234", email: "ventas@alqueria.co", address: "Km 5 Vía Chía, Cundinamarca", active: true },
  { id: "sup-2", name: "Distribuidora Nacional de Granos", nit: "900.222.111-9", phone: "3185559876", email: "pedidos@gricol.com", address: "Carrera 30 # 12 - 45, Bogotá", active: true },
  { id: "sup-3", name: "Insumos y Accesorios del Caribe", nit: "890.333.555-4", phone: "3158882244", email: "contacto@iacaribe.co", address: "Vía 40 # 70 - 12, Barranquilla", active: true },
];

// Helper to get past dates relative to today
const getPastDateString = (daysAgo: number, hour = 10, minute = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

// Seed Sales Invoices
const generateSeededInvoices = (): Invoice[] => [
  {
    id: "FV-1001",
    client: { id: "cli-juan", name: "Juan Fernando Pérez", nitOrCc: "1015432876" },
    items: [
      { productId: "prod-1", name: "Arroz Diana Florhuila Premium 1kg", qty: 3, price: 4500, taxRate: 0, total: 13500 },
      { productId: "prod-2", name: "Aceite Gourmet Multiusos 1L", qty: 1, price: 13900, taxRate: 5, total: 13900 },
    ],
    subtotal: 26738,
    taxAmount: 662,
    total: 27400,
    paymentMethod: "CASH",
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(6, 9, 15),
    receivedAmount: 30000,
    changeAmount: 2600,
  },
  {
    id: "FV-1002",
    client: { id: "cli-consumidor", name: "Consumidor Final (Público General)", nitOrCc: "222222222222" },
    items: [
      { productId: "prod-4", name: "Mouse Inalámbrico Logitech M185 Gris", qty: 1, price: 79900, taxRate: 19, total: 79900 },
    ],
    subtotal: 67143,
    taxAmount: 12757,
    total: 79900,
    paymentMethod: "CARD",
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(5, 11, 30),
    receivedAmount: 79900,
    changeAmount: 0,
  },
  {
    id: "FV-1003",
    client: { id: "cli-distribuidora", name: "Comercializadora DistriNorte S.A.S.", nitOrCc: "900.555.123-4" },
    items: [
      { productId: "prod-5", name: "Teclado Mecánico Redragon Kumara K552 RGB", qty: 2, price: 219000, taxRate: 19, total: 438000 },
      { productId: "prod-6", name: "Bombillo LED Philips EcoHome 9W E27 Luz Fría", qty: 10, price: 7500, taxRate: 19, total: 75000 },
    ],
    subtotal: 431092,
    taxAmount: 81908,
    total: 513000,
    paymentMethod: "CREDIT", // owes money
    status: "PAID",
    sellerId: "usr-admin",
    sellerName: "Administrador General",
    createdAt: getPastDateString(4, 14, 20),
    receivedAmount: 0,
    changeAmount: 0,
  },
  {
    id: "FV-1004",
    client: { id: "cli-consumidor", name: "Consumidor Final (Público General)", nitOrCc: "222222222222" },
    items: [
      { productId: "prod-3", name: "Café Sello Rojo 500g", qty: 2, price: 11500, taxRate: 0, total: 23000 },
      { productId: "prod-7", name: "Coca-Cola Original Sabor Original 1.5L", qty: 4, price: 5200, taxRate: 19, total: 20800 },
    ],
    subtotal: 40479,
    taxAmount: 3321,
    total: 43800,
    paymentMethod: "NEQUI_DAVIPLATA",
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(3, 16, 45),
    receivedAmount: 43800,
    changeAmount: 0,
  },
  {
    id: "FV-1005",
    client: { id: "cli-maria", name: "María Camila Gómez", nitOrCc: "52432876" },
    items: [
      { productId: "prod-1", name: "Arroz Diana Florhuila Premium 1kg", qty: 5, price: 4500, taxRate: 0, total: 22500 },
      { productId: "prod-2", name: "Aceite Gourmet Multiusos 1L", qty: 2, price: 13900, taxRate: 5, total: 27800 },
      { productId: "prod-3", name: "Café Sello Rojo 500g", qty: 1, price: 11500, taxRate: 0, total: 11500 },
    ],
    subtotal: 60476,
    taxAmount: 1324,
    total: 61800,
    paymentMethod: "CASH",
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(2, 10, 10),
    receivedAmount: 100000,
    changeAmount: 38200,
  },
  {
    id: "FV-1006",
    client: { id: "cli-consumidor", name: "Consumidor Final (Público General)", nitOrCc: "222222222222" },
    items: [
      { productId: "prod-6", name: "Bombillo LED Philips EcoHome 9W E27 Luz Fría", qty: 5, price: 7500, taxRate: 19, total: 37500 },
    ],
    subtotal: 31513,
    taxAmount: 5987,
    total: 37500,
    paymentMethod: "CASH",
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(1, 15, 30),
    receivedAmount: 50000,
    changeAmount: 12500,
  },
  {
    id: "FV-1007",
    client: { id: "cli-juan", name: "Juan Fernando Pérez", nitOrCc: "1015432876" },
    items: [
      { productId: "prod-4", name: "Mouse Inalámbrico Logitech M185 Gris", qty: 1, price: 79900, taxRate: 19, total: 79900 },
      { productId: "prod-7", name: "Coca-Cola Original Sabor Original 1.5L", qty: 2, price: 5200, taxRate: 19, total: 10400 },
    ],
    subtotal: 75882,
    taxAmount: 14418,
    total: 90300,
    paymentMethod: "CREDIT", // owes money
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(1, 17, 10),
    receivedAmount: 0,
    changeAmount: 0,
  },
  {
    id: "FV-1008",
    client: { id: "cli-consumidor", name: "Consumidor Final (Público General)", nitOrCc: "222222222222" },
    items: [
      { productId: "prod-1", name: "Arroz Diana Florhuila Premium 1kg", qty: 2, price: 4500, taxRate: 0, total: 9000 },
      { productId: "prod-2", name: "Aceite Gourmet Multiusos 1L", qty: 1, price: 13900, taxRate: 5, total: 13900 },
    ],
    subtotal: 22238,
    taxAmount: 662,
    total: 22900,
    paymentMethod: "NEQUI_DAVIPLATA",
    status: "PAID",
    sellerId: "usr-cajero",
    sellerName: "Carlos Cajero (Vendedor)",
    createdAt: getPastDateString(0, 11, 15),
    receivedAmount: 22900,
    changeAmount: 0,
  },
];

// Seed Expenses
const DEFAULT_EXPENSES: Expense[] = [
  { id: "G-1001", category: "Servicios Públicos", description: "Pago de luz Codensa de la bodega", amount: 185000, paymentMethod: "CASH", createdAt: getPastDateString(5, 16, 0) },
  { id: "G-1002", category: "Papelería", description: "Compra de resmas de papel e implementos", amount: 45000, paymentMethod: "CASH", createdAt: getPastDateString(4, 11, 0) },
  { id: "G-1003", category: "Arriendo", description: "Pago arriendo local comercial junio", amount: 1200000, paymentMethod: "TRANSFER", createdAt: getPastDateString(3, 9, 30) },
  { id: "G-1004", category: "Mantenimiento", description: "Reparación bombillos y chapas", amount: 65000, paymentMethod: "CASH", createdAt: getPastDateString(1, 14, 0) },
];

// Seed Purchase Invoices (Supplier Purchases to Restock)
const DEFAULT_PURCHASES: PurchaseInvoice[] = [
  {
    id: "FC-1001",
    invoiceNumber: "INV-998877",
    supplierId: "sup-1",
    supplierName: "Alquería de Colombia S.A.",
    items: [
      { productId: "prod-1", name: "Arroz Diana Florhuila Premium 1kg", qty: 100, purchasePrice: 3200, total: 320000 },
    ],
    total: 320000,
    createdAt: getPastDateString(6, 8, 30),
  },
  {
    id: "FC-1002",
    invoiceNumber: "FC-4455-A",
    supplierId: "sup-2",
    supplierName: "Distribuidora Nacional de Granos",
    items: [
      { productId: "prod-2", name: "Aceite Gourmet Multiusos 1L", qty: 50, purchasePrice: 9500, total: 475000 },
      { productId: "prod-3", name: "Café Sello Rojo 500g", qty: 60, purchasePrice: 8200, total: 492000 },
    ],
    total: 967000,
    createdAt: getPastDateString(4, 10, 0),
  },
];

/**
 * Gets all suppliers.
 */
export const getSuppliers = (): Supplier[] => {
  const suppliers = readJSON<Supplier[]>(SUPPLIERS_KEY, []);
  if (suppliers.length === 0) {
    writeJSON(SUPPLIERS_KEY, DEFAULT_SUPPLIERS);
    return DEFAULT_SUPPLIERS;
  }
  return suppliers;
};

/**
 * Saves all suppliers.
 */
export const saveSuppliers = (suppliers: Supplier[]): void => {
  writeJSON(SUPPLIERS_KEY, suppliers);
};

/**
 * Upserts a supplier.
 */
export const upsertSupplier = (supplier: Supplier): Supplier => {
  const suppliers = getSuppliers();
  const index = suppliers.findIndex((s) => s.id === supplier.id);

  if (index >= 0) {
    suppliers[index] = { ...suppliers[index], ...supplier };
  } else {
    supplier.id = supplier.id || `sup-${Date.now()}`;
    suppliers.push(supplier);
  }

  saveSuppliers(suppliers);
  return supplier;
};

/**
 * Deletes a supplier.
 */
export const deleteSupplier = (id: string): boolean => {
  const suppliers = getSuppliers();
  const filtered = suppliers.filter((s) => s.id !== id);
  if (filtered.length !== suppliers.length) {
    saveSuppliers(filtered);
    return true;
  }
  return false;
};

/**
 * Gets all purchase invoices.
 */
export const getPurchases = (): PurchaseInvoice[] => {
  const purchases = readJSON<PurchaseInvoice[]>(PURCHASES_KEY, []);
  if (purchases.length === 0) {
    writeJSON(PURCHASES_KEY, DEFAULT_PURCHASES);
    return DEFAULT_PURCHASES;
  }
  return purchases;
};

/**
 * Records a new purchase invoice and restocks the corresponding items.
 */
export const recordPurchaseInvoice = (purchase: PurchaseInvoice): PurchaseInvoice => {
  const purchases = getPurchases();
  purchase.id = purchase.id || `FC-${Date.now()}`;
  purchase.createdAt = purchase.createdAt || new Date().toISOString();
  purchases.push(purchase);
  
  writeJSON(PURCHASES_KEY, purchases);
  
  // Adjust stock positively
  const stockAdjustments = purchase.items.map((item) => ({
    id: item.productId,
    qty: item.qty,
  }));
  bulkAdjustStock(stockAdjustments);

  return purchase;
};

/**
 * Gets all sales invoices.
 */
export const getInvoices = (): Invoice[] => {
  const invoices = readJSON<Invoice[]>(INVOICES_KEY, []);
  if (invoices.length === 0) {
    const seeded = generateSeededInvoices();
    writeJSON(INVOICES_KEY, seeded);
    return seeded;
  }
  return invoices;
};

/**
 * Saves all sales invoices.
 */
export const saveInvoices = (invoices: Invoice[]): void => {
  writeJSON(INVOICES_KEY, invoices);
};

/**
 * Registers a new sales invoice.
 * Handles decreasing stock and increasing client credit balances if paymentMethod is CREDIT.
 */
export const createInvoice = (invoice: Omit<Invoice, "id" | "createdAt">): Invoice => {
  const invoices = getInvoices();
  const nextIdNum = invoices.length > 0 
    ? Math.max(...invoices.map((inv) => parseInt(inv.id.replace("FV-", "")))) + 1 
    : 1001;
  
  const newInvoice: Invoice = {
    ...invoice,
    id: `FV-${nextIdNum}`,
    createdAt: new Date().toISOString(),
  };

  invoices.push(newInvoice);
  saveInvoices(invoices);

  // Decrease stock
  const stockAdjustments = newInvoice.items.map((item) => ({
    id: item.productId,
    qty: -item.qty, // negative to subtract
  }));
  bulkAdjustStock(stockAdjustments);

  // If credit transaction, add to the client's credit balance
  if (newInvoice.paymentMethod === "CREDIT" && newInvoice.client.id !== "cli-consumidor") {
    const clients = getClients();
    const clientIndex = clients.findIndex((c) => c.id === newInvoice.client.id);
    if (clientIndex >= 0) {
      clients[clientIndex].creditBalance += newInvoice.total;
      saveClients(clients);
    }
  }

  return newInvoice;
};

/**
 * Deletes a sales invoice and cancels stock alterations or debt.
 */
export const deleteInvoice = (invoiceId: string): boolean => {
  const invoices = getInvoices();
  const invoiceIndex = invoices.findIndex((inv) => inv.id === invoiceId);
  if (invoiceIndex < 0) return false;

  const invoice = invoices[invoiceIndex];

  // Re-adjust stock positively
  const stockAdjustments = invoice.items.map((item) => ({
    id: item.productId,
    qty: item.qty, // positive to re-add
  }));
  bulkAdjustStock(stockAdjustments);

  // If credit, subtract from client's credit balance
  if (invoice.paymentMethod === "CREDIT" && invoice.client.id !== "cli-consumidor") {
    const clients = getClients();
    const clientIndex = clients.findIndex((c) => c.id === invoice.client.id);
    if (clientIndex >= 0) {
      clients[clientIndex].creditBalance = Math.max(0, clients[clientIndex].creditBalance - invoice.total);
      saveClients(clients);
    }
  }

  invoices.splice(invoiceIndex, 1);
  saveInvoices(invoices);
  return true;
};

/**
 * Gets all refund logs.
 */
export const getRefunds = (): Refund[] => {
  return readJSON<Refund[]>(REFUNDS_KEY, []);
};

/**
 * Registers a refund.
 */
export const registerRefund = (refund: Omit<Refund, "id" | "createdAt">): Refund => {
  const refunds = getRefunds();
  const newRefund: Refund = {
    ...refund,
    id: `REF-${1000 + refunds.length + 1}`,
    createdAt: new Date().toISOString(),
  };

  refunds.push(newRefund);
  writeJSON(REFUNDS_KEY, refunds);

  // Update original invoice status
  const invoices = getInvoices();
  const invoice = invoices.find((inv) => inv.id === newRefund.invoiceId);
  if (invoice) {
    // Check if fully or partially refunded
    // Simplification: Mark as REFUNDED if matching original total, otherwise PARTIALLY_REFUNDED
    invoice.status = "REFUNDED";
    saveInvoices(invoices);
  }

  // Restock items if restocked is true
  if (newRefund.restocked) {
    const stockAdjustments = newRefund.items.map((item) => ({
      id: item.productId,
      qty: item.qty, // positive to return to inventory
    }));
    bulkAdjustStock(stockAdjustments);
  }

  // Audit Log Entry
  addAuditLog({
    userId: "admin@softwork.co",
    userName: "Administrador General",
    userRole: "ADMIN",
    category: "SALES_VOID",
    severity: "CRITICAL",
    action: "ANULAR_FACTURA",
    entityId: newRefund.invoiceId,
    entityName: `Factura ${newRefund.invoiceId}`,
    details: `Anulación de venta por un total de $${newRefund.totalRefunded.toLocaleString("es-CO")} COP. Mercancía reingresada: ${newRefund.restocked ? "SÍ" : "NO"}.`,
    previousState: `Factura ${newRefund.invoiceId} Estado PAGADA`,
    newState: `Factura ${newRefund.invoiceId} Estado REFUNDED/ANULADA`
  });

  return newRefund;
};

/**
 * Gets all expenses.
 */
export const getExpenses = (): Expense[] => {
  const expenses = readJSON<Expense[]>(EXPENSES_KEY, []);
  if (expenses.length === 0) {
    writeJSON(EXPENSES_KEY, DEFAULT_EXPENSES);
    return DEFAULT_EXPENSES;
  }
  return expenses;
};

/**
 * Saves expenses.
 */
export const saveExpenses = (expenses: Expense[]): void => {
  writeJSON(EXPENSES_KEY, expenses);
};

/**
 * Creates/modifies an expense.
 */
export const upsertExpense = (expense: Expense): Expense => {
  const expenses = getExpenses();
  const index = expenses.findIndex((e) => e.id === expense.id);

  if (index >= 0) {
    expenses[index] = { ...expenses[index], ...expense };
  } else {
    expense.id = expense.id || `G-${Date.now()}`;
    expense.createdAt = expense.createdAt || new Date().toISOString();
    expenses.push(expense);
  }

  saveExpenses(expenses);
  return expense;
};

/**
 * Deletes an expense.
 */
export const deleteExpense = (id: string): boolean => {
  const expenses = getExpenses();
  const targetExp = expenses.find((e) => e.id === id);
  const filtered = expenses.filter((e) => e.id !== id);

  if (filtered.length !== expenses.length) {
    saveExpenses(filtered);

    // Critical Audit Log for Expense Deletion
    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador General",
      userRole: "ADMIN",
      category: "ENTRY_DELETE",
      severity: "HIGH",
      action: "ELIMINAR_GASTO",
      entityId: id,
      entityName: targetExp?.description || targetExp?.category || `Gasto ${id}`,
      details: `Eliminación de registro de egreso/gasto por $${targetExp?.amount.toLocaleString("es-CO") || "0"} COP (${targetExp?.description || targetExp?.category || id}).`,
      previousState: targetExp ? `Monto: $${targetExp.amount} COP` : undefined,
      newState: "Registro Eliminado"
    });

    return true;
  }
  return false;
};

/**
 * Gets all cash closures.
 */
export const getCashClosures = (): CashRegisterClosure[] => {
  return readJSON<CashRegisterClosure[]>(CASH_CLOSURES_KEY, []);
};

/**
 * Performs a cash register closure.
 */
export const recordCashRegisterClosure = (closure: Omit<CashRegisterClosure, "id" | "closedAt">): CashRegisterClosure => {
  const closures = getCashClosures();
  const newClosure: CashRegisterClosure = {
    ...closure,
    id: `CLO-${Date.now()}`,
    closedAt: new Date().toISOString(),
  };

  closures.push(newClosure);
  writeJSON(CASH_CLOSURES_KEY, closures);
  return newClosure;
};
