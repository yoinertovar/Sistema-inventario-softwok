import { readJSON, writeJSON } from "./storage.service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY_CONFIG } from "../config/config";
import { formatDateTimeCO } from "../utils/colombia";

export type AuditCategory =
  | "SALES_VOID"
  | "INVENTORY_MODIFY"
  | "ENTRY_DELETE"
  | "PRICE_CHANGE"
  | "CREDIT_ACTION"
  | "USER_MANAGEMENT"
  | "SYSTEM_SECURITY";

export type AuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  entityId?: string;
  entityName?: string;
  details: string;
  ipAddress?: string;
  previousState?: string;
  newState?: string;
}

const AUDIT_LOGS_KEY = "softwork_audit_trail_logs";

/**
 * Seed initial audit entries if storage is empty to demonstrate immediate value.
 */
const INITIAL_SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "AUD-2026-0891",
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 mins ago
    userId: "admin@softwork.co",
    userName: "Administrador General",
    userRole: "ADMIN",
    category: "SALES_VOID",
    severity: "CRITICAL",
    action: "ANULAR_FACTURA",
    entityId: "FAC-2026-004",
    entityName: "Factura Venta $145.000",
    details: "Anulación total de factura por solicitud de cliente (cobro duplicado). Mercancía reingresada.",
    ipAddress: "192.168.1.10 (Terminal Admin)",
    previousState: "Estado: PAGADA ($145.000 COP)",
    newState: "Estado: ANULADA / DEVUELTA ($0 COP)"
  },
  {
    id: "AUD-2026-0890",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    userId: "cajero@softwork.co",
    userName: "Carlos Cajero",
    userRole: "WORKER",
    category: "INVENTORY_MODIFY",
    severity: "HIGH",
    action: "AJUSTE_STOCK_PROD",
    entityId: "PROD-770123",
    entityName: "Café Especial Premium 500g",
    details: "Modificación directa de stock físico por arqueo parcial. Stock reducido de 35u a 12u por avería.",
    ipAddress: "192.168.1.15 (Caja 01)",
    previousState: "Stock: 35 unidades",
    newState: "Stock: 12 unidades (Merma -23u)"
  },
  {
    id: "AUD-2026-0889",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5 hrs ago
    userId: "admin@softwork.co",
    userName: "Administrador General",
    userRole: "ADMIN",
    category: "ENTRY_DELETE",
    severity: "CRITICAL",
    action: "ELIMINAR_REGISTRO",
    entityId: "CLI-902",
    entityName: "Distribuidora del Norte S.A.S.",
    details: "Eliminación permanente del registro de cliente de la base de datos comercial.",
    ipAddress: "192.168.1.10 (Terminal Admin)",
    previousState: "Cliente Activo en Sistema",
    newState: "Registro Eliminado"
  },
  {
    id: "AUD-2026-0888",
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hrs ago
    userId: "admin@softwork.co",
    userName: "Administrador General",
    userRole: "ADMIN",
    category: "PRICE_CHANGE",
    severity: "MEDIUM",
    action: "CAMBIO_PRECIO",
    entityId: "PROD-882100",
    entityName: "Aceite de Oliva Extra Virgen 1L",
    details: "Modificación del precio de venta al público por actualización de lista de costos del proveedor.",
    ipAddress: "192.168.1.10 (Terminal Admin)",
    previousState: "Precio: $38.000 COP",
    newState: "Precio: $42.500 COP"
  },
  {
    id: "AUD-2026-0887",
    timestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(), // 5.3 hrs ago
    userId: "admin@softwork.co",
    userName: "Administrador General",
    userRole: "ADMIN",
    category: "USER_MANAGEMENT",
    severity: "HIGH",
    action: "MODIFICAR_PERMISOS",
    entityId: "USR-002",
    entityName: "Carlos Cajero (Caja 01)",
    details: "Otorgamiento de permiso especial 'Permitir Descuentos Manuales' a operario de caja.",
    ipAddress: "192.168.1.10 (Terminal Admin)",
    previousState: "Permisos Estándar WORKER",
    newState: "Permisos WORKER + DESCUENTO_MANUAL"
  },
  {
    id: "AUD-2026-0886",
    timestamp: new Date(Date.now() - 1000 * 60 * 600).toISOString(), // 10 hrs ago
    userId: "cajero@softwork.co",
    userName: "Carlos Cajero",
    userRole: "WORKER",
    category: "CREDIT_ACTION",
    severity: "MEDIUM",
    action: "ABONO_CREDITO",
    entityId: "CRED-1042",
    entityName: "Crédito Cliente María Gómez",
    details: "Recepción de abono en efectivo por $200.000 COP sobre saldo adeudado.",
    ipAddress: "192.168.1.15 (Caja 01)",
    previousState: "Saldo Deuda: $500.000 COP",
    newState: "Saldo Deuda: $300.000 COP"
  }
];

/**
 * Gets all audit log entries.
 */
export const getAuditLogs = (): AuditLogEntry[] => {
  const stored = readJSON<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
  if (!stored || stored.length === 0) {
    writeJSON(AUDIT_LOGS_KEY, INITIAL_SEED_AUDIT_LOGS);
    return INITIAL_SEED_AUDIT_LOGS;
  }
  return stored;
};

/**
 * Creates and appends a new audit log entry.
 */
export const addAuditLog = (
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): AuditLogEntry => {
  const currentLogs = getAuditLogs();
  const idNum = Math.floor(1000 + Math.random() * 9000);
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `AUD-${new Date().getFullYear()}-${idNum}`,
    timestamp: new Date().toISOString(),
    ipAddress: entry.ipAddress || "192.168.1.10 (Local Session)"
  };

  const updatedLogs = [newEntry, ...currentLogs].slice(0, 500); // Keep last 500 records
  writeJSON(AUDIT_LOGS_KEY, updatedLogs);

  // Notify listeners
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("softwork_audit_update", { detail: newEntry }));
  }, 0);

  return newEntry;
};

/**
 * Clears all audit log history (restricted action).
 */
export const clearAuditLogs = (): void => {
  writeJSON(AUDIT_LOGS_KEY, []);
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("softwork_audit_update", { detail: null }));
  }, 0);
};

/* ==========================================================================
   AUDIT EXPORT UTILITIES (CSV & PDF)
   ========================================================================== */

const escapeCSV = (field: string | number | boolean | null | undefined): string => {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportAuditTrailCSV = (logs: AuditLogEntry[]): void => {
  const headers = [
    "ID Auditoría",
    "Fecha y Hora",
    "Usuario",
    "Rol",
    "Categoría",
    "Gravedad",
    "Acción Registrada",
    "Entidad Afectada",
    "Detalles / Justificación",
    "Dirección IP"
  ];

  const rows = logs.map((log) => [
    log.id,
    formatDateTimeCO(log.timestamp),
    `${log.userName} (${log.userId})`,
    log.userRole,
    log.category,
    log.severity,
    log.action,
    log.entityName || log.entityId || "N/A",
    log.details,
    log.ipAddress || "N/A"
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => r.map(escapeCSV).join(","))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `auditoria_seguridad_${new Date().toISOString().split("T")[0]}.csv`;
  downloadBlob(blob, filename);
};

export const exportAuditTrailPDF = (logs: AuditLogEntry[]): void => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const nowStr = formatDateTimeCO(new Date());

  // Header Banner
  doc.setFillColor(15, 23, 42); // Dark slate
  doc.rect(0, 0, 297, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_CONFIG.name, 14, 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`NIT: ${COMPANY_CONFIG.nit} | Tel: ${COMPANY_CONFIG.phone}`, 14, 18);
  doc.text(`Dirección: ${COMPANY_CONFIG.address}`, 14, 23);

  // Title Right
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("INFORME DE AUDITORÍA Y TRAZABILIDAD DE SEGURIDAD", 283, 12, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha Emisión: ${nowStr}`, 283, 18, { align: "right" });
  doc.text(`Módulo: Registro de Operaciones Críticas (Audit Trail)`, 283, 23, { align: "right" });

  // Summary Metrics Banner
  const criticals = logs.filter((l) => l.severity === "CRITICAL").length;
  const highs = logs.filter((l) => l.severity === "HIGH").length;
  const voids = logs.filter((l) => l.category === "SALES_VOID").length;
  const deletes = logs.filter((l) => l.category === "ENTRY_DELETE").length;

  doc.setFillColor(248, 250, 252);
  doc.rect(14, 32, 269, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 32, 269, 18, "S");

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");

  doc.text("EVENTOS AUDITADOS", 20, 37);
  doc.text("EVENTOS CRÍTICOS", 85, 37);
  doc.text("VENTAS ANULADAS", 150, 37);
  doc.text("ELIMINACIONES REGISTRADAS", 215, 37);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${logs.length} registros`, 20, 44);
  doc.text(`${criticals + highs} eventos`, 85, 44);
  doc.text(`${voids} anulación(es)`, 150, 44);
  doc.text(`${deletes} borrado(s)`, 215, 44);

  const tableHeaders = [
    ["ID AUDIT", "FECHA / HORA", "USUARIO", "CATEGORÍA", "GRAVEDAD", "ACCIÓN", "ENTIDAD", "DETALLES OPERACIÓN"]
  ];

  const tableRows = logs.map((l) => [
    l.id,
    formatDateTimeCO(l.timestamp),
    `${l.userName}\n(${l.userRole})`,
    l.category,
    l.severity,
    l.action,
    l.entityName || l.entityId || "N/A",
    l.details
  ]);

  autoTable(doc, {
    startY: 54,
    head: tableHeaders,
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 32 },
      2: { cellWidth: 35 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 28 },
      6: { cellWidth: 35 },
      7: { cellWidth: 63 }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const str = `Página ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 283, 202, { align: "right" });
      doc.text("SoftWork POS - Reporte Confidencial de Trazabilidad y Seguridad", 14, 202);
    }
  });

  const filename = `auditoria_seguridad_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};
