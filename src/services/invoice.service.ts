import { readJSON, writeJSON } from "./storage.service";
import { getToken } from "./auth.service";
import { bulkAdjustStock } from "./product.service";
import { getClients, saveClients } from "./client.service";

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
  id: string;
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
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: "Arriendo" | "Servicios Públicos" | "Nómina" | "Papelería" | "Mantenimiento" | "Otros";
  description: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  createdAt: string;
}

export interface CashRegisterClosure {
  id: string;
  closedBy: string;
  closedByName: string;
  openedAt: string;
  closedAt: string;
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  electronicSales: number;
  creditSales: number;
  totalSales: number;
  cashExpenses: number;
  expectedCashInBox: number;
  countedCash: number;
  countedCard: number;
  countedElectronic: number;
  cashDiscrepancy: number;
  observations: string;
  status: "COMPLETED";
}

const INVOICES_KEY = "softwork_invoices";
const REFUNDS_KEY = "softwork_refunds";
const SUPPLIERS_KEY = "softwork_suppliers";
const PURCHASES_KEY = "softwork_purchases";
const EXPENSES_KEY = "softwork_expenses";
const CASH_CLOSURES_KEY = "softwork_cash_closures";

/**
 * Obtener facturas de venta desde PostgreSQL
 */
export const fetchInvoices = async (): Promise<Invoice[]> => {
  try {
    const res = await fetch("/api/sales", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      const mapped = data.map((inv: any) => ({
        id: inv.invoiceNumber || inv.id,
        client: { id: "", name: inv.clientName || "Consumidor Final", nitOrCc: inv.clientNit || "222222222222" },
        items: [],
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        total: inv.total,
        paymentMethod: inv.paymentMethod,
        status: inv.status,
        sellerId: "",
        sellerName: inv.sellerName || "Vendedor",
        createdAt: inv.createdAt,
        receivedAmount: inv.receivedAmount,
        changeAmount: inv.changeAmount
      }));
      writeJSON(INVOICES_KEY, mapped);
      return mapped;
    }
  } catch (error) {
    console.warn("Fallo de red al consultar facturas en PG:", error);
  }
  return readJSON<Invoice[]>(INVOICES_KEY, []);
};

/**
 * Registrar una venta POS en PostgreSQL
 */
export const createInvoiceApi = async (invoiceData: {
  clientId?: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number; taxRate?: number }>;
  paymentMethod: string;
  receivedAmount?: number;
}): Promise<any> => {
  const res = await fetch("/api/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(invoiceData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al registrar la venta en la base de datos.");
  }

  await fetchInvoices();
  return data.invoice;
};

/**
 * Wrapper de compatibilidad para creación de factura
 */
export const createInvoice = (invoice: Omit<Invoice, "id" | "createdAt">): Invoice => {
  const invoices = getInvoices();
  const nextIdNum = invoices.length > 0 ? Math.max(...invoices.map((inv) => parseInt(inv.id.replace("FV-", "")) || 1000)) + 1 : 1001;
  const newInv: Invoice = {
    ...invoice,
    id: `FV-${nextIdNum}`,
    createdAt: new Date().toISOString()
  };

  invoices.push(newInv);
  writeJSON(INVOICES_KEY, invoices);

  // Enviar a la base de datos PostgreSQL
  createInvoiceApi({
    clientId: invoice.client.id,
    items: invoice.items.map((it) => ({
      productId: it.productId,
      quantity: it.qty,
      unitPrice: it.price,
      taxRate: it.taxRate
    })),
    paymentMethod: invoice.paymentMethod,
    receivedAmount: invoice.receivedAmount
  }).catch(console.error);

  return newInv;
};

export const deleteInvoice = (invoiceId: string): boolean => {
  const invoices = getInvoices();
  const filtered = invoices.filter((inv) => inv.id !== invoiceId);
  if (filtered.length !== invoices.length) {
    writeJSON(INVOICES_KEY, filtered);
    return true;
  }
  return false;
};

/**
 * Obtener proveedores desde PostgreSQL
 */
export const fetchSuppliers = async (): Promise<Supplier[]> => {
  try {
    const res = await fetch("/api/suppliers", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      writeJSON(SUPPLIERS_KEY, data);
      return data;
    }
  } catch (error) {
    console.warn("Fallo al obtener proveedores de PG:", error);
  }
  return readJSON<Supplier[]>(SUPPLIERS_KEY, []);
};

export const upsertSupplier = async (supplier: Partial<Supplier>): Promise<Supplier> => {
  const res = await fetch("/api/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(supplier)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Error al guardar proveedor.");
  await fetchSuppliers();
  return data.supplier;
};

export const deleteSupplier = (id: string): boolean => {
  const suppliers = getSuppliers();
  const filtered = suppliers.filter((s) => s.id !== id);
  if (filtered.length !== suppliers.length) {
    writeJSON(SUPPLIERS_KEY, filtered);
    return true;
  }
  return false;
};

/**
 * Registrar ingreso de mercancía / compra en PostgreSQL
 */
export const recordPurchaseInvoiceApi = async (purchaseData: {
  supplierId: string;
  supplierInvoice?: string;
  items: Array<{ productId: string; quantity: number; purchasePrice?: number }>;
}): Promise<any> => {
  const res = await fetch("/api/suppliers/purchases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(purchaseData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Error al registrar ingreso de mercancía.");
  return data.purchase;
};

export const recordPurchaseInvoice = (purchase: PurchaseInvoice): PurchaseInvoice => {
  const purchases = getPurchases();
  purchase.id = purchase.id || `FC-${Date.now()}`;
  purchase.createdAt = purchase.createdAt || new Date().toISOString();
  purchases.push(purchase);
  writeJSON(PURCHASES_KEY, purchases);

  recordPurchaseInvoiceApi({
    supplierId: purchase.supplierId,
    supplierInvoice: purchase.invoiceNumber,
    items: purchase.items.map((it) => ({ productId: it.productId, quantity: it.qty, purchasePrice: it.purchasePrice }))
  }).catch(console.error);

  return purchase;
};

/**
 * Gastos
 */
export const fetchExpenses = async (): Promise<Expense[]> => {
  try {
    const res = await fetch("/api/finance/expenses", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      writeJSON(EXPENSES_KEY, data);
      return data;
    }
  } catch (error) {
    console.warn("Fallo al obtener gastos de PG:", error);
  }
  return readJSON<Expense[]>(EXPENSES_KEY, []);
};

export const createExpenseApi = async (expense: { category: string; description: string; amount: number; paymentMethod: string }): Promise<any> => {
  const res = await fetch("/api/finance/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(expense)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Error al guardar el gasto.");
  await fetchExpenses();
  return data.expense;
};

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
  writeJSON(EXPENSES_KEY, expenses);

  createExpenseApi({
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod
  }).catch(console.error);

  return expense;
};

export const deleteExpense = (id: string): boolean => {
  const expenses = getExpenses();
  const filtered = expenses.filter((e) => e.id !== id);
  if (filtered.length !== expenses.length) {
    writeJSON(EXPENSES_KEY, filtered);
    return true;
  }
  return false;
};

/**
 * Cierre de Caja
 */
export const recordCashRegisterClosureApi = async (closure: {
  countedCash: number;
  countedCard: number;
  countedElectronic: number;
  openingBalance?: number;
  observations?: string;
}): Promise<any> => {
  const res = await fetch("/api/finance/cash-closures", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(closure)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Error al guardar el cierre de caja.");
  return data.closure;
};

export const recordCashRegisterClosure = (closure: Omit<CashRegisterClosure, "id" | "closedAt">): CashRegisterClosure => {
  const closures = getCashClosures();
  const newClosure: CashRegisterClosure = {
    ...closure,
    id: `CLO-${Date.now()}`,
    closedAt: new Date().toISOString()
  };
  closures.push(newClosure);
  writeJSON(CASH_CLOSURES_KEY, closures);

  recordCashRegisterClosureApi({
    countedCash: closure.countedCash,
    countedCard: closure.countedCard,
    countedElectronic: closure.countedElectronic,
    openingBalance: closure.openingBalance,
    observations: closure.observations
  }).catch(console.error);

  return newClosure;
};

/**
 * Devoluciones
 */
export const getRefunds = (): Refund[] => readJSON<Refund[]>(REFUNDS_KEY, []);
export const registerRefund = (refund: Omit<Refund, "id" | "createdAt">): Refund => {
  const refunds = getRefunds();
  const newRefund: Refund = {
    ...refund,
    id: `REF-${1000 + refunds.length + 1}`,
    createdAt: new Date().toISOString()
  };
  refunds.push(newRefund);
  writeJSON(REFUNDS_KEY, refunds);
  return newRefund;
};

// Fallbacks de lectura síncrona
export const getInvoices = (): Invoice[] => readJSON<Invoice[]>(INVOICES_KEY, []);
export const saveInvoices = (invoices: Invoice[]): void => writeJSON(INVOICES_KEY, invoices);
export const getSuppliers = (): Supplier[] => readJSON<Supplier[]>(SUPPLIERS_KEY, []);
export const saveSuppliers = (suppliers: Supplier[]): void => writeJSON(SUPPLIERS_KEY, suppliers);
export const getPurchases = (): PurchaseInvoice[] => readJSON<PurchaseInvoice[]>(PURCHASES_KEY, []);
export const getExpenses = (): Expense[] => readJSON<Expense[]>(EXPENSES_KEY, []);
export const saveExpenses = (expenses: Expense[]): void => writeJSON(EXPENSES_KEY, expenses);
export const getCashClosures = (): CashRegisterClosure[] => readJSON<CashRegisterClosure[]>(CASH_CLOSURES_KEY, []);
