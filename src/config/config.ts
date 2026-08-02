export const COMPANY_CONFIG = {
  name: "SoftWork Solutions S.A.S.",
  nit: "901.432.876-1",
  address: "Calle 45 # 12 - 34, Bogotá, Colombia",
  phone: "+57 (601) 345-6789",
  email: "contacto@softwork.co",
  receiptHeader: "REGISTRO DE VENTA",
  receiptFooter: "¡Gracias por su compra!\nDesarrollado por SoftWork POS\nConserve su factura.",
  currency: "COP",
  taxRate: 19, // 19% IVA default in Colombia
};

export const APP_CONFIG = {
  version: "1.0.0",
  environment: "production",
  allowOfflineMode: true,
  maxWorkspaces: 5,
};

export const CURRENCY_CONFIG = {
  locale: "es-CO",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

export const DATE_CONFIG = {
  locale: "es-CO",
  timeZone: "America/Bogota",
};

export default {
  COMPANY_CONFIG,
  APP_CONFIG,
  CURRENCY_CONFIG,
  DATE_CONFIG,
};
