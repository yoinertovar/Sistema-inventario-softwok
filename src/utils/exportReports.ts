import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, Category } from "../services/product.service";
import { Invoice, Refund } from "../services/invoice.service";
import { COMPANY_CONFIG } from "../config/config";
import { formatCOP, formatDateTimeCO, formatDateCO } from "./colombia";

// Helper for CSV escaping
const escapeCSV = (field: string | number | boolean | null | undefined): string => {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Helper for triggering browser file downloads
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

/* ==========================================================================
   1. INVENTORY EXPORTS (CSV & PDF)
   ========================================================================== */

/**
 * Export Inventory Report to CSV
 */
export const exportInventoryCSV = (products: Product[], categories: Category[]): void => {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const headers = [
    "Código Barcode",
    "Producto",
    "Categoría",
    "Descripción",
    "Costo Compra (COP)",
    "Precio Venta (COP)",
    "Tarifa IVA (%)",
    "Stock Actual",
    "Stock Mínimo",
    "Valor Total Costo (COP)",
    "Valor Total Venta Base (COP)",
    "Valor Total Venta con IVA (COP)",
    "Margen Bruto Potencial (COP)",
    "Estado"
  ];

  let totalStock = 0;
  let totalPurchaseVal = 0;
  let totalSaleVal = 0;
  let totalSaleWithTaxVal = 0;
  let totalProfit = 0;

  const rows = products.map((p) => {
    const categoryName = categoryMap.get(p.category) || p.category || "Sin Categoría";
    const qty = p.stock || 0;
    const purchaseVal = (p.purchasePrice || 0) * qty;
    const saleVal = (p.salePrice || 0) * qty;
    const saleWithTaxVal = (p.salePrice || 0) * (1 + (p.taxRate || 0) / 100) * qty;
    const potentialProfit = saleVal - purchaseVal;

    totalStock += qty;
    totalPurchaseVal += purchaseVal;
    totalSaleVal += saleVal;
    totalSaleWithTaxVal += saleWithTaxVal;
    totalProfit += potentialProfit;

    return [
      p.barcode,
      p.name,
      categoryName,
      p.description || "",
      p.purchasePrice,
      p.salePrice,
      p.taxRate,
      p.stock,
      p.minStock,
      purchaseVal,
      saleVal,
      Math.round(saleWithTaxVal),
      potentialProfit,
      p.active ? "Activo" : "Inactivo"
    ];
  });

  const summaryRow = [
    "TOTALES AUDITADOS",
    `Items: ${products.length} productos`,
    "",
    "",
    "",
    "",
    "",
    totalStock,
    "",
    totalPurchaseVal,
    totalSaleVal,
    Math.round(totalSaleWithTaxVal),
    totalProfit,
    ""
  ];

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => r.map(escapeCSV).join(",")),
    summaryRow.map(escapeCSV).join(",")
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `reporte_inventario_contable_${new Date().toISOString().split("T")[0]}.csv`;
  downloadBlob(blob, filename);
};

/**
 * Export Inventory Report to PDF (Accounting Format)
 */
export const exportInventoryPDF = (products: Product[], categories: Category[]): void => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const nowStr = formatDateTimeCO(new Date());

  // Totals calculations
  let totalStock = 0;
  let totalPurchaseVal = 0;
  let totalSaleVal = 0;
  let totalProfit = 0;

  products.forEach((p) => {
    const qty = p.stock || 0;
    totalStock += qty;
    totalPurchaseVal += (p.purchasePrice || 0) * qty;
    totalSaleVal += (p.salePrice || 0) * (1 + (p.taxRate || 0) / 100) * qty;
    totalProfit += ((p.salePrice || 0) - (p.purchasePrice || 0)) * qty;
  });

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // Dark slate bg
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
  doc.text("REPORTE DE INVENTARIO Y VALORIZACIÓN CONTABLE", 283, 12, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de Emisión: ${nowStr}`, 283, 18, { align: "right" });
  doc.text(`Fines: Balance Financiero y Control Fiscal`, 283, 23, { align: "right" });

  // Summary Metrics Banner (KPIs)
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 32, 269, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 32, 269, 18, "S");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");

  doc.text("TOTAL PRODUCTOS", 20, 37);
  doc.text("UNIDADES STOCK", 80, 37);
  doc.text("VALORIZACIÓN COSTO (COMPRA)", 140, 37);
  doc.text("VALORIZACIÓN BRUTA (VENTA CON IVA)", 210, 37);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${products.length} SKUs`, 20, 44);
  doc.text(`${totalStock} Unds`, 80, 44);
  doc.text(formatCOP(totalPurchaseVal), 140, 44);
  doc.text(formatCOP(totalSaleVal), 210, 44);

  // Table Columns
  const tableHeaders = [
    ["CÓDIGO / SKU", "PRODUCTO", "CATEGORÍA", "STOCK", "P. COMPRA", "P. VENTA", "IVA", "VALOR COSTO", "VALOR VENTA", "ESTADO"]
  ];

  const tableRows = products.map((p) => {
    const categoryName = categoryMap.get(p.category) || p.category || "General";
    const qty = p.stock || 0;
    const costVal = (p.purchasePrice || 0) * qty;
    const saleValWithTax = (p.salePrice || 0) * (1 + (p.taxRate || 0) / 100) * qty;

    return [
      p.barcode || p.id,
      p.name,
      categoryName,
      `${qty} u.`,
      formatCOP(p.purchasePrice || 0),
      formatCOP(p.salePrice || 0),
      `${p.taxRate || 0}%`,
      formatCOP(costVal),
      formatCOP(saleValWithTax),
      p.active ? "Activo" : "Inactivo"
    ];
  });

  // Table Footer summary row
  const tableFooter = [
    [
      "TOTALES",
      `SKUs: ${products.length}`,
      "-",
      `${totalStock} u.`,
      "-",
      "-",
      "-",
      formatCOP(totalPurchaseVal),
      formatCOP(totalSaleVal),
      "-"
    ]
  ];

  autoTable(doc, {
    startY: 54,
    head: tableHeaders,
    body: tableRows,
    foot: tableFooter,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left"
    },
    footStyles: {
      fillColor: [241, 245, 249], // Slate 100
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 28 }, // Barcode
      1: { cellWidth: 60 }, // Name
      2: { cellWidth: 32 }, // Category
      3: { cellWidth: 18, halign: "center" }, // Stock
      4: { cellWidth: 25, halign: "right" }, // Buy
      5: { cellWidth: 25, halign: "right" }, // Sell
      6: { cellWidth: 15, halign: "center" }, // Tax
      7: { cellWidth: 28, halign: "right" }, // Total Cost
      8: { cellWidth: 28, halign: "right" }, // Total Sale
      9: { cellWidth: 18, halign: "center" }  // Status
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Page Footer
      const str = `Página ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 283, 202, { align: "right" });
      doc.text("SoftWork POS - Reporte Contable de Inventario Confidencial", 14, 202);
    }
  });

  const filename = `reporte_inventario_contable_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};

/* ==========================================================================
   2. SALES HISTORY & INVOICES EXPORTS (CSV & PDF)
   ========================================================================== */

/**
 * Export Sales History to CSV
 */
export const exportSalesHistoryCSV = (invoices: Invoice[]): void => {
  const headers = [
    "Nº Factura",
    "Fecha y Hora",
    "Cliente",
    "NIT / Cédula",
    "Vendedor",
    "Método de Pago",
    "Cant. Artículos",
    "Subtotal (COP)",
    "IVA Impuestos (COP)",
    "Total Facturado (COP)",
    "Efectivo Recibido (COP)",
    "Cambio Entregado (COP)",
    "Estado"
  ];

  let totalGrossRevenue = 0;
  let totalSubtotal = 0;
  let totalTaxes = 0;
  let totalItemsCount = 0;

  const rows = invoices.map((inv) => {
    const itemsCount = inv.items.reduce((sum, item) => sum + item.qty, 0);
    totalItemsCount += itemsCount;
    totalSubtotal += inv.subtotal || 0;
    totalTaxes += inv.taxAmount || 0;
    totalGrossRevenue += inv.total || 0;

    const methodLabels: Record<string, string> = {
      CASH: "Efectivo",
      CARD: "Tarjeta Débito/Crédito",
      NEQUI_DAVIPLATA: "Transferencia (Nequi/Daviplata)",
      CREDIT: "Crédito Comercial"
    };

    const statusLabels: Record<string, string> = {
      PAID: "Pagada",
      REFUNDED: "Devuelta / Anulada",
      PARTIALLY_REFUNDED: "Parcialmente Devuelta"
    };

    return [
      inv.id,
      formatDateTimeCO(inv.createdAt),
      inv.client?.name || "Cliente General",
      inv.client?.nitOrCc || "N/A",
      inv.sellerName || "N/A",
      methodLabels[inv.paymentMethod] || inv.paymentMethod,
      itemsCount,
      inv.subtotal,
      inv.taxAmount,
      inv.total,
      inv.receivedAmount || inv.total,
      inv.changeAmount || 0,
      statusLabels[inv.status] || inv.status
    ];
  });

  const summaryRow = [
    "TOTALES AUDITADOS",
    `Total Facturas: ${invoices.length}`,
    "",
    "",
    "",
    "",
    totalItemsCount,
    totalSubtotal,
    totalTaxes,
    totalGrossRevenue,
    "",
    "",
    ""
  ];

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => r.map(escapeCSV).join(",")),
    summaryRow.map(escapeCSV).join(",")
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `reporte_ventas_contable_${new Date().toISOString().split("T")[0]}.csv`;
  downloadBlob(blob, filename);
};

/**
 * Export Sales History to PDF (Accounting Format)
 */
export const exportSalesHistoryPDF = (invoices: Invoice[]): void => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const nowStr = formatDateTimeCO(new Date());

  // Metrics calculation
  let totalRevenue = 0;
  let totalSubtotal = 0;
  let totalTaxes = 0;
  let cashRevenue = 0;
  let cardRevenue = 0;
  let digitalRevenue = 0;
  let creditRevenue = 0;

  invoices.forEach((inv) => {
    if (inv.status !== "REFUNDED") {
      totalRevenue += inv.total || 0;
      totalSubtotal += inv.subtotal || 0;
      totalTaxes += inv.taxAmount || 0;

      if (inv.paymentMethod === "CASH") cashRevenue += inv.total;
      else if (inv.paymentMethod === "CARD") cardRevenue += inv.total;
      else if (inv.paymentMethod === "NEQUI_DAVIPLATA") digitalRevenue += inv.total;
      else if (inv.paymentMethod === "CREDIT") creditRevenue += inv.total;
    }
  });

  // Top Header Banner
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
  doc.text("REPORTE DE VENTAS Y FACTURACIÓN CONTABLE", 283, 12, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado: ${nowStr}`, 283, 18, { align: "right" });
  doc.text(`Uso: Auditoría Fiscal y Contable de Ingresos`, 283, 23, { align: "right" });

  // Summary Metrics Banner (KPIs)
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 32, 269, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 32, 269, 18, "S");

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");

  doc.text("FACTURAS EMITIDAS", 20, 37);
  doc.text("SUBTOTAL BASE", 75, 37);
  doc.text("IMPUESTOS (IVA 19%)", 130, 37);
  doc.text("RECAUDO TOTAL BRUTO", 195, 37);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${invoices.length} recibos`, 20, 44);
  doc.text(formatCOP(totalSubtotal), 75, 44);
  doc.text(formatCOP(totalTaxes), 130, 44);
  doc.text(formatCOP(totalRevenue), 195, 44);

  // Table Headers
  const tableHeaders = [
    ["FACTURA", "FECHA / HORA", "CLIENTE", "NIT/CC", "VENDEDOR", "PAGO", "SUBTOTAL", "IVA", "TOTAL", "ESTADO"]
  ];

  const methodLabels: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    NEQUI_DAVIPLATA: "Nequi/Daviplata",
    CREDIT: "Crédito"
  };

  const tableRows = invoices.map((inv) => [
    inv.id,
    formatDateCO(inv.createdAt),
    inv.client?.name || "Cliente General",
    inv.client?.nitOrCc || "N/A",
    inv.sellerName || "Cajero",
    methodLabels[inv.paymentMethod] || inv.paymentMethod,
    formatCOP(inv.subtotal || 0),
    formatCOP(inv.taxAmount || 0),
    formatCOP(inv.total || 0),
    inv.status === "PAID" ? "Pagada" : inv.status === "REFUNDED" ? "Anulada" : "Parcial"
  ]);

  const tableFooter = [
    [
      "TOTALES",
      `${invoices.length} reg.`,
      "-",
      "-",
      "-",
      "-",
      formatCOP(totalSubtotal),
      formatCOP(totalTaxes),
      formatCOP(totalRevenue),
      "-"
    ]
  ];

  autoTable(doc, {
    startY: 54,
    head: tableHeaders,
    body: tableRows,
    foot: tableFooter,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left"
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 25 }, // ID
      1: { cellWidth: 32 }, // Date
      2: { cellWidth: 55 }, // Client
      3: { cellWidth: 28 }, // NIT
      4: { cellWidth: 28 }, // Seller
      5: { cellWidth: 25 }, // Payment
      6: { cellWidth: 24, halign: "right" }, // Subtotal
      7: { cellWidth: 22, halign: "right" }, // Tax
      8: { cellWidth: 26, halign: "right" }, // Total
      9: { cellWidth: 20, halign: "center" }  // Status
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const str = `Página ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 283, 202, { align: "right" });
      doc.text("SoftWork POS - Reporte Contable de Ventas Confidencial", 14, 202);
    }
  });

  const filename = `reporte_ventas_contable_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};

/* ==========================================================================
   3. REFUNDS & AUDIT EXPORTS (CSV & PDF)
   ========================================================================== */

/**
 * Export Refunds / Devoluciones Report to CSV
 */
export const exportRefundsCSV = (refunds: Refund[]): void => {
  const headers = [
    "ID Devolución",
    "Factura Origen",
    "Fecha y Hora",
    "Artículos Devueltos",
    "Motivo / Causa",
    "Restock Inventario",
    "Total Devuelto (COP)"
  ];

  let totalRefunded = 0;

  const rows = refunds.map((ref) => {
    totalRefunded += ref.totalRefunded || 0;
    const itemsSummary = ref.items.map((i) => `${i.name} (x${i.qty})`).join(" | ");
    const reasonsSummary = ref.items.map((i) => i.reason).join(" | ");

    return [
      ref.id,
      ref.invoiceId,
      formatDateTimeCO(ref.createdAt),
      itemsSummary,
      reasonsSummary,
      ref.restocked ? "Sí (Reingresado)" : "No (Baja/Mermas)",
      ref.totalRefunded
    ];
  });

  const summaryRow = [
    "TOTAL DEVOLUCIONES",
    `Total Registros: ${refunds.length}`,
    "",
    "",
    "",
    "",
    totalRefunded
  ];

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => r.map(escapeCSV).join(",")),
    summaryRow.map(escapeCSV).join(",")
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `reporte_devoluciones_contable_${new Date().toISOString().split("T")[0]}.csv`;
  downloadBlob(blob, filename);
};

/**
 * Export Refunds / Devoluciones Report to PDF
 */
export const exportRefundsPDF = (refunds: Refund[]): void => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const nowStr = formatDateTimeCO(new Date());

  const totalRefundedValue = refunds.reduce((sum, r) => sum + (r.totalRefunded || 0), 0);

  // Top Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_CONFIG.name, 14, 11);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`NIT: ${COMPANY_CONFIG.nit} | Tel: ${COMPANY_CONFIG.phone}`, 14, 18);
  doc.text(`Dirección: ${COMPANY_CONFIG.address}`, 14, 23);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("REPORTE DE AUDITORÍA Y DEVOLUCIONES", 283, 12, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha Emisión: ${nowStr}`, 283, 18, { align: "right" });
  doc.text(`Uso: Ajustes de Caja y Mermas Contables`, 283, 23, { align: "right" });

  // Summary Card
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 32, 269, 18, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 32, 269, 18, "S");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL CASOS DEVOLUCIÓN", 20, 37);
  doc.text("MONTO TOTAL REEMBOLSADO", 150, 37);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${refunds.length} auditorías`, 20, 44);
  doc.text(formatCOP(totalRefundedValue), 150, 44);

  const tableHeaders = [
    ["ID DEVOLUCIÓN", "FACTURA ORIGEN", "FECHA", "ARTÍCULOS", "MOTIVO / RAZÓN", "RESTOCK", "TOTAL REEMBOLSADO"]
  ];

  const tableRows = refunds.map((ref) => [
    ref.id,
    ref.invoiceId,
    formatDateCO(ref.createdAt),
    ref.items.map((i) => `${i.name} (x${i.qty})`).join("\n"),
    ref.items.map((i) => i.reason).join("\n"),
    ref.restocked ? "Sí" : "No",
    formatCOP(ref.totalRefunded || 0)
  ]);

  const tableFooter = [
    ["TOTALES", `${refunds.length} registros`, "-", "-", "-", "-", formatCOP(totalRefundedValue)]
  ];

  autoTable(doc, {
    startY: 54,
    head: tableHeaders,
    body: tableRows,
    foot: tableFooter,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold"
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 28 },
      3: { cellWidth: 70 },
      4: { cellWidth: 65 },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 26, halign: "right" }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const str = `Página ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 283, 202, { align: "right" });
    }
  });

  const filename = `reporte_devoluciones_contable_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};
