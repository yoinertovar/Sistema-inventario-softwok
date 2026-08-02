import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../utils/permissions";
import { PERMISSIONS } from "../../../permissions/PermissionConstants";
import {
  getInvoices,
  deleteInvoice,
  registerRefund,
  getRefunds,
  Invoice,
  Refund
} from "../../../services/invoice.service";
import { getProducts, saveProducts } from "../../../services/product.service";
import { formatCOP, formatDateCO } from "../../../utils/colombia";
import { exportSalesHistoryCSV, exportSalesHistoryPDF } from "../../../utils/exportReports";
import { COMPANY_CONFIG } from "../../../config/config";
import {
  History,
  Search,
  Eye,
  Printer,
  RotateCcw,
  Trash2,
  Calendar,
  User,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Receipt,
  X,
  ShieldCheck,
  TrendingUp,
  FileX,
  Download,
  FileText
} from "lucide-react";

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Sub-permissions
  const canVoidInvoice = hasPermission(user, PERMISSIONS.DELETE_INVOICE);
  const canProcessReturns = hasPermission(user, PERMISSIONS.MANAGE_RETURNS);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [search, setSearch] = useState("");

  // Details Modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  // Thermal ticket print preview modal
  const [printOpen, setPrintOpen] = useState(false);

  // Refund Modal
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundQtyMap, setRefundQtyMap] = useState<{ [productId: string]: number }>({});
  const [refundReason, setRefundReason] = useState("");
  const [restockReturned, setRestockReturned] = useState(true);

  const loadData = () => {
    setInvoices(getInvoices());
    setRefunds(getRefunds());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      return (
        inv.id.toLowerCase().includes(q) ||
        inv.client.name.toLowerCase().includes(q) ||
        inv.client.nitOrCc.includes(q) ||
        inv.sellerName.toLowerCase().includes(q) ||
        inv.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [invoices, search]);

  // Aggregate invoice metrics
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalRefundedCount = refunds.length;

    return {
      totalCount,
      totalRevenue,
      totalRefundedCount,
    };
  }, [invoices, refunds]);

  const handleDeleteInvoice = (inv: Invoice) => {
    if (!canVoidInvoice) {
      showToast("Permiso denegado: No tiene permisos para anular facturas de venta.", "warning");
      return;
    }
    showConfirm({
      title: "Eliminar Factura",
      message: `¿Está seguro de que desea anular y eliminar la factura "${inv.id}"? Esta acción reabastecerá los inventarios de los productos involucrados y cancelará la deuda del cliente si fue a crédito.`,
      confirmText: "Anular Factura",
      severity: "danger",
      onConfirm: () => {
        deleteInvoice(inv.id);
        showToast(`Factura ${inv.id} anulada con éxito. Catálogos actualizados.`, "success");
        loadData();
      },
    });
  };

  const openRefundModal = (inv: Invoice) => {
    if (!canProcessReturns) {
      showToast("Permiso denegado: No tiene permisos para procesar devoluciones.", "warning");
      return;
    }
    setActiveInvoice(inv);
    const initialQtys: { [productId: string]: number } = {};
    inv.items.forEach((item) => {
      initialQtys[item.productId] = item.qty; // default to refund everything
    });
    setRefundQtyMap(initialQtys);
    setRefundReason("Devolución por defecto / insatisfacción");
    setRestockReturned(true);
    setRefundOpen(true);
  };

  const handleProcessRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProcessReturns) {
      showToast("Permiso denegado: No tiene permisos para efectuar devoluciones.", "error");
      return;
    }
    if (!activeInvoice) return;

    // Build refund items list
    const refundItems = activeInvoice.items
      .map((item) => {
        const qtyToRefund = refundQtyMap[item.productId] || 0;
        return {
          productId: item.productId,
          name: item.name,
          qty: qtyToRefund,
          price: item.price,
          reason: refundReason,
        };
      })
      .filter((item) => item.qty > 0);

    if (refundItems.length === 0) {
      showToast("Debe seleccionar al menos un producto para aplicar la devolución.", "error");
      return;
    }

    const totalRefunded = refundItems.reduce((sum, item) => sum + (item.qty * item.price), 0);

    showConfirm({
      title: "Confirmar Devolución",
      message: `¿Está seguro de que desea procesar la devolución de ${refundItems.length} artículos por un valor total de ${formatCOP(totalRefunded)}?`,
      confirmText: "Procesar Devolución",
      severity: "warning",
      onConfirm: () => {
        registerRefund({
          invoiceId: activeInvoice.id,
          items: refundItems,
          totalRefunded,
          restocked: restockReturned,
        });

        showToast("Devolución procesada y guardada correctamente.", "success");
        setRefundOpen(false);
        setDetailOpen(false);
        loadData();
      },
    });
  };

  // Launch browser native print on the POS ticket block
  const handleNativePrint = () => {
    const printContent = document.getElementById("thermal-print-ticket");
    if (!printContent) return;

    const windowUrl = "about:blank";
    const uniqueName = new Date().getTime();
    const windowName = "Print" + uniqueName;
    const prtWin = window.open(windowUrl, windowName, "left=100,top=100,width=400,height=600");

    if (prtWin) {
      prtWin.document.write(`
        <html>
          <head>
            <title>Imprimir Factura</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.4; color: #000; width: 280px; margin: 0 auto; padding: 10px; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 8px 0; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { padding: 3px 0; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function(){ window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      prtWin.document.close();
      prtWin.focus();
    } else {
      showToast("No se pudo abrir la ventana de impresión. Habilite las ventanas emergentes (popups) en su navegador.", "warning");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page Title & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
            <History className="w-5.5 h-5.5 text-indigo-600 dark:text-indigo-400" /> Historial General de Ventas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consulte los registros de facturas POS emitidas, realice reimpresiones de tickets térmicos o procese devoluciones de inventario.
          </p>
        </div>

        {/* Export Buttons for Admins & Accounting */}
        {user?.role === "ADMIN" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                exportSalesHistoryCSV(filteredInvoices);
                showToast("Reporte de ventas en CSV exportado exitosamente.", "success");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/50 dark:border-emerald-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Exportar reporte de ventas a formato CSV para contabilidad"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Exportar CSV
            </button>

            <button
              type="button"
              onClick={() => {
                exportSalesHistoryPDF(filteredInvoices);
                showToast("Reporte contable de ventas en PDF generado exitosamente.", "success");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/50 dark:border-rose-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Exportar reporte contable de ventas a formato PDF"
            >
              <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* METRIC COUNTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total revenue */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturación Consolidada</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(stats.totalRevenue)}
            </h3>
          </div>
        </div>

        {/* Invoice count */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas Emitidas</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {stats.totalCount} Ventas registradas
            </h3>
          </div>
        </div>

        {/* Refunds count */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Devoluciones Aplicadas</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {stats.totalRefundedCount} Casos procesados
            </h3>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Buscar por factura N°, cliente, cajero o medio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </div>
      </div>

      {/* INVOICES TABLE LOG */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                <th className="py-3.5 px-6">Factura N°</th>
                <th className="py-3.5 px-6">Cliente (Comprador)</th>
                <th className="py-3.5 px-6">Fecha y Hora</th>
                <th className="py-3.5 px-6">Atendido por</th>
                <th className="py-3.5 px-6">Medio de Pago</th>
                <th className="py-3.5 px-6 text-center">Estado</th>
                <th className="py-3.5 px-6 text-right">Monto Facturado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    No se registran facturas emitidas coincidentes.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isRefunded = inv.status === "REFUNDED";

                  return (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 tracking-tight">{inv.id}</td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800 leading-tight">{inv.client.name}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">CC/NIT: {inv.client.nitOrCc}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {new Date(inv.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" })}
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 opacity-60" /> {inv.sellerName}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase border border-slate-200">
                          {inv.paymentMethod === "NEQUI_DAVIPLATA" ? "Nequi/Daviplata" : inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            isRefunded ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isRefunded ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
                          {isRefunded ? "Devuelto" : "Cobrado"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-black text-slate-900">{formatCOP(inv.total)}</td>
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {/* Details */}
                          <button
                            onClick={() => {
                              setActiveInvoice(inv);
                              setDetailOpen(true);
                            }}
                            className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-slate-400 transition-all"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {/* Print ticket */}
                          <button
                            onClick={() => {
                              setActiveInvoice(inv);
                              setPrintOpen(true);
                            }}
                            className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-slate-400 transition-all"
                            title="Imprimir Recibo"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Refund */}
                          {!isRefunded && (
                            <button
                              onClick={() => openRefundModal(inv)}
                              disabled={!canProcessReturns}
                              title={!canProcessReturns ? "Permiso denegado: No tiene permiso para procesar devoluciones." : "Procesar Devolución"}
                              className={`p-1.5 rounded-lg transition-all ${
                                !canProcessReturns
                                  ? "text-slate-300 cursor-not-allowed opacity-50"
                                  : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
                              }`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteInvoice(inv)}
                            disabled={!canVoidInvoice}
                            title={!canVoidInvoice ? "Permiso denegado: No tiene permiso para anular facturas." : "Anular Factura"}
                            className={`p-1.5 rounded-lg transition-all ${
                              !canVoidInvoice
                                ? "text-slate-300 cursor-not-allowed opacity-50"
                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETALLE COMPLETO MODAL (DRAWER SHEET) */}
      {detailOpen && activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md h-full bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Receipt className="w-5 h-5 text-indigo-600" /> Detalle Factura {activeInvoice.id}
                  </h3>
                  <span className="text-[10px] text-slate-400 mt-1 block">Facturación POS Autorizada</span>
                </div>
                <button onClick={() => setDetailOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Client & Operator info card */}
              <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl mb-5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="font-semibold">Cliente:</span>
                  <span className="font-bold text-slate-900">{activeInvoice.client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">NIT / Documento:</span>
                  <span className="font-mono text-slate-900">{activeInvoice.client.nitOrCc}</span>
                </div>
                <div className="w-full h-px bg-slate-200/50" />
                <div className="flex justify-between">
                  <span className="font-semibold">Cajero operador:</span>
                  <span className="font-bold text-slate-900">{activeInvoice.sellerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Fecha y Hora:</span>
                  <span>{new Date(activeInvoice.createdAt).toLocaleString("es-CO")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Medio de Pago:</span>
                  <span className="font-bold uppercase text-indigo-600">{activeInvoice.paymentMethod}</span>
                </div>
              </div>

              {/* Item lists */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Artículos Facturados
                </span>
                
                {activeInvoice.items.map((item, idx) => (
                  <div key={idx} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800 leading-snug">{item.name}</p>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        {item.qty} u. x {formatCOP(item.price)} (IVA {item.taxRate}%)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">{formatCOP(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial summaries footer */}
            <div className="pt-4 border-t border-slate-100 mt-6 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>{formatCOP(activeInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-medium">
                <span>IVA Recaudado</span>
                <span>{formatCOP(activeInvoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-50">
                <span>Total Factura</span>
                <span>{formatCOP(activeInvoice.total)}</span>
              </div>

              {activeInvoice.paymentMethod !== "CREDIT" && (
                <div className="flex justify-between text-[11px] text-slate-400 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span>Recibido: {formatCOP(activeInvoice.receivedAmount)}</span>
                  <span className="font-bold text-slate-700">Cambio: {formatCOP(activeInvoice.changeAmount)}</span>
                </div>
              )}

              <button
                onClick={() => {
                  setDetailOpen(false);
                  setPrintOpen(true);
                }}
                className="w-full mt-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Printer className="w-4.5 h-4.5" /> Reimprimir Factura POS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT THERMAL TICKET MODAL */}
      {printOpen && activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Printer className="w-4.5 h-4.5 text-indigo-600" /> Vista Impresión Térmica (80mm)
              </h3>
              <button onClick={() => setPrintOpen(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Preview block (Styled explicitly for thermal 80mm monospace printers) */}
            <div className="p-6 max-h-96 overflow-y-auto bg-slate-50">
              <div
                id="thermal-print-ticket"
                className="bg-white border border-slate-200 p-4 font-mono text-[11px] text-slate-900 leading-tight shadow-sm select-all"
                style={{ width: "260px", margin: "0 auto" }}
              >
                <div className="text-center">
                  <p className="bold text-sm uppercase">{COMPANY_CONFIG.name}</p>
                  <p>NIT: {COMPANY_CONFIG.nit}</p>
                  <p>{COMPANY_CONFIG.address}</p>
                  <p>Cel: {COMPANY_CONFIG.phone}</p>
                  <p className="divider">--------------------------------</p>
                  <p className="bold uppercase">{COMPANY_CONFIG.receiptHeader}</p>
                  <p className="bold">N°: {activeInvoice.id}</p>
                  <p className="divider">--------------------------------</p>
                </div>
                
                <p>Fecha: {new Date(activeInvoice.createdAt).toLocaleString("es-CO")}</p>
                <p>Cliente: {activeInvoice.client.name}</p>
                <p>Doc/NIT: {activeInvoice.client.nitOrCc}</p>
                <p>Cajero: {activeInvoice.sellerName}</p>
                <p className="divider">--------------------------------</p>
                
                {/* List items */}
                <table className="w-full font-mono text-[10px] text-slate-900 border-none">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left font-bold" style={{ width: "50%" }}>Descripción</th>
                      <th className="text-center font-bold" style={{ width: "15%" }}>Cant</th>
                      <th className="text-right font-bold" style={{ width: "35%" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-left leading-snug">{item.name}</td>
                        <td className="text-center">{item.qty}</td>
                        <td className="text-right">{formatCOP(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <p className="divider">--------------------------------</p>
                
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCOP(activeInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuesto IVA:</span>
                  <span>{formatCOP(activeInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between bold">
                  <span>TOTAL PAGADO:</span>
                  <span>{formatCOP(activeInvoice.total)}</span>
                </div>
                
                <p className="divider">--------------------------------</p>
                <p className="text-center bold uppercase">PAGO: {activeInvoice.paymentMethod}</p>
                
                {activeInvoice.paymentMethod !== "CREDIT" && (
                  <div className="text-center">
                    <p>Efectivo Recibido: {formatCOP(activeInvoice.receivedAmount)}</p>
                    <p>Cambio Entregado: {formatCOP(activeInvoice.changeAmount)}</p>
                  </div>
                )}
                
                <p className="divider">--------------------------------</p>
                <div className="text-center leading-snug whitespace-pre-line">
                  {COMPANY_CONFIG.receiptFooter}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setPrintOpen(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl"
              >
                Cerrar
              </button>
              
              <button
                type="button"
                onClick={handleNativePrint}
                className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Lanzar Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESS REFUND/RETURN OVERLAY SHEET */}
      {refundOpen && activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-1.5">
                <RotateCcw className="w-5 h-5 text-amber-500 animate-spin" /> Procesar Devolución de Venta
              </h3>
              <button onClick={() => setRefundOpen(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessRefund} className="p-6 flex flex-col gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Seleccione cantidades a devolver de {activeInvoice.id}
              </span>

              {/* Items listing with quantity triggers */}
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {activeInvoice.items.map((item) => (
                  <div key={item.productId} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Original: {item.qty} u. x {formatCOP(item.price)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={refundQtyMap[item.productId] || 0}
                        onChange={(e) => setRefundQtyMap({ ...refundQtyMap, [item.productId]: Number(e.target.value) })}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
                      >
                        {Array.from({ length: item.qty + 1 }, (_, idx) => (
                          <option key={idx} value={idx}>
                            {idx} u.
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Motivo / Justificación *</label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ej. Producto vencido / El cliente desistió de la compra"
                />
              </div>

              {/* Restock checkbox */}
              <div>
                <label className="text-xs font-bold text-slate-600 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockReturned}
                    onChange={(e) => setRestockReturned(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Reingresar unidades devueltas al stock del inventario</span>
                </label>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefundOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Confirmar Devolución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
