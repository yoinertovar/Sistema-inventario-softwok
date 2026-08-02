export const PERMISSIONS = {
  // Inventory permissions
  VIEW_INVENTORY: "view_inventory",
  CREATE_PRODUCT: "create_product",
  EDIT_PRODUCT: "edit_product",
  DELETE_PRODUCT: "delete_product",
  MANAGE_CATEGORIES: "manage_categories",
  
  // Clients permissions
  VIEW_CLIENTS: "view_clients",
  CREATE_CLIENT: "create_client",
  EDIT_CLIENT: "edit_client",
  DELETE_CLIENT: "delete_client",
  
  // Credit permissions
  VIEW_CREDITS: "view_credits",
  PROCESS_CREDIT_PAYMENT: "process_credit_payment",
  CREATE_CREDIT: "create_credit",
  DELETE_CREDIT: "delete_credit",
  
  // Expense permissions
  VIEW_EXPENSES: "view_expenses",
  CREATE_EXPENSE: "create_expense",
  EDIT_EXPENSE: "edit_expense",
  DELETE_EXPENSE: "delete_expense",
  
  // Suppliers permissions
  VIEW_SUPPLIERS: "view_suppliers",
  CREATE_SUPPLIER: "create_supplier",
  EDIT_SUPPLIER: "edit_supplier",
  DELETE_SUPPLIER: "delete_supplier",
  RECORD_PURCHASE_INVOICE: "record_purchase_invoice",
  
  // Payroll permissions
  VIEW_PAYROLL: "view_payroll",
  MANAGE_WORKERS: "manage_workers",
  CALCULATE_PAYROLL: "calculate_payroll",
  RECORD_PAYMENT: "record_payment",
  
  // User Management permissions
  VIEW_USERS: "view_users",
  CREATE_USER: "create_user",
  EDIT_USER: "edit_user",
  DELETE_USER: "delete_user",
  
  // POS / Cash registers permissions
  ACCESS_POS: "access_pos",
  CLOSE_CASH_REGISTER: "close_cash_register",
  MANAGE_RETURNS: "manage_returns",
  VIEW_SALES_HISTORY: "view_sales_history",
  DELETE_INVOICE: "delete_invoice",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const PERMISSION_CATEGORIES = {
  INVENTORY: {
    label: "Inventario",
    permissions: [
      { id: PERMISSIONS.VIEW_INVENTORY, label: "Ver catálogo de productos" },
      { id: PERMISSIONS.CREATE_PRODUCT, label: "Crear nuevos productos" },
      { id: PERMISSIONS.EDIT_PRODUCT, label: "Editar productos" },
      { id: PERMISSIONS.DELETE_PRODUCT, label: "Eliminar productos" },
      { id: PERMISSIONS.MANAGE_CATEGORIES, label: "Gestionar categorías" },
    ],
  },
  CLIENTS: {
    label: "Clientes",
    permissions: [
      { id: PERMISSIONS.VIEW_CLIENTS, label: "Ver base de clientes" },
      { id: PERMISSIONS.CREATE_CLIENT, label: "Registrar nuevos clientes" },
      { id: PERMISSIONS.EDIT_CLIENT, label: "Editar información de clientes" },
      { id: PERMISSIONS.DELETE_CLIENT, label: "Eliminar clientes" },
    ],
  },
  CREDITS: {
    label: "Créditos y Cuentas por Cobrar",
    permissions: [
      { id: PERMISSIONS.VIEW_CREDITS, label: "Ver créditos vigentes" },
      { id: PERMISSIONS.CREATE_CREDIT, label: "Asignar nuevos cupos de crédito" },
      { id: PERMISSIONS.PROCESS_CREDIT_PAYMENT, label: "Registrar abonos / pagos" },
      { id: PERMISSIONS.DELETE_CREDIT, label: "Eliminar historiales de crédito" },
    ],
  },
  EXPENSES: {
    label: "Gastos",
    permissions: [
      { id: PERMISSIONS.VIEW_EXPENSES, label: "Ver registro de gastos" },
      { id: PERMISSIONS.CREATE_EXPENSE, label: "Registrar nuevos gastos" },
      { id: PERMISSIONS.EDIT_EXPENSE, label: "Modificar registros de gastos" },
      { id: PERMISSIONS.DELETE_EXPENSE, label: "Eliminar comprobantes de gastos" },
    ],
  },
  SUPPLIERS: {
    label: "Proveedores",
    permissions: [
      { id: PERMISSIONS.VIEW_SUPPLIERS, label: "Ver listado de proveedores" },
      { id: PERMISSIONS.CREATE_SUPPLIER, label: "Crear proveedores" },
      { id: PERMISSIONS.EDIT_SUPPLIER, label: "Editar proveedores" },
      { id: PERMISSIONS.DELETE_SUPPLIER, label: "Eliminar proveedores" },
      { id: PERMISSIONS.RECORD_PURCHASE_INVOICE, label: "Ingresar facturas de compra (Stock)" },
    ],
  },
  PAYROLL: {
    label: "Nómina y Personal",
    permissions: [
      { id: PERMISSIONS.VIEW_PAYROLL, label: "Ver nómina y registros de pago" },
      { id: PERMISSIONS.MANAGE_WORKERS, label: "Crear/Editar trabajadores" },
      { id: PERMISSIONS.CALCULATE_PAYROLL, label: "Calcular salarios y comisiones" },
      { id: PERMISSIONS.RECORD_PAYMENT, label: "Registrar pagos y anticipos" },
    ],
  },
  USERS: {
    label: "Seguridad y Usuarios",
    permissions: [
      { id: PERMISSIONS.VIEW_USERS, label: "Ver lista de usuarios" },
      { id: PERMISSIONS.CREATE_USER, label: "Crear cuentas de usuario" },
      { id: PERMISSIONS.EDIT_USER, label: "Modificar cuentas y permisos" },
      { id: PERMISSIONS.DELETE_USER, label: "Eliminar cuentas de usuario" },
    ],
  },
  POS: {
    label: "Punto de Venta (POS)",
    permissions: [
      { id: PERMISSIONS.ACCESS_POS, label: "Ingresar al módulo de facturación" },
      { id: PERMISSIONS.CLOSE_CASH_REGISTER, label: "Realizar arqueo y cierre de caja" },
      { id: PERMISSIONS.MANAGE_RETURNS, label: "Procesar devoluciones y reembolsos" },
      { id: PERMISSIONS.VIEW_SALES_HISTORY, label: "Ver historial de facturas emitidas" },
      { id: PERMISSIONS.DELETE_INVOICE, label: "Eliminar facturas del registro" },
    ],
  },
};
