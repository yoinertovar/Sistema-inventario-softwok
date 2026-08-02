export const APP_NAME = "SoftWork POS & Inventario";

export const ROLES = {
  ADMIN: "ADMIN",
  WORKER: "WORKER",
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROUTES = {
  LOGIN: "/login",
  UNAUTHORIZED: "/unauthorized",
  
  // Admin Routes
  ADMIN_DASHBOARD: "/admin/dashboard",
  SUPPLIERS: "/admin/suppliers",
  PAYROLL: "/admin/payroll",
  USERS: "/admin/users",
  AUDIT_TRAIL: "/admin/audit-trail",
  
  // Shared Routes (accessible based on role/permissions)
  INVENTORY: "/shared/inventory",
  CLIENTS: "/shared/clients",
  CREDITS: "/shared/credits",
  EXPENSES: "/shared/expenses",
  HISTORY: "/shared/history",
  INVOICES: "/shared/invoices",
  
  // Worker Routes
  WORKER_DASHBOARD: "/worker/dashboard",
  WORKSPACE: "/worker/workspace",
  CASH_REGISTER: "/worker/cash-register",
  RETURNS: "/worker/returns",
} as const;

export const COLORS = {
  primary: "indigo",
  success: "emerald",
  danger: "rose",
  warning: "amber",
  info: "sky",
} as const;
