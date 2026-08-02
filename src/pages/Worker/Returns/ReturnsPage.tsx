import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../utils/permissions";
import { PERMISSIONS } from "../../../permissions/PermissionConstants";
import { getInvoices, registerRefund, getRefunds, Invoice } from "../../../services/invoice.service";
import { formatCOP, formatDateCO } from "../../../utils/colombia";
import {
  RotateCcw,
  Search,
  CheckCircle,
  AlertTriangle,
  Receipt,
  ArrowRight,
  RotateCw,
  Package,
  Calendar,
  X,
  FileText
} from "lucide-react";

export const ReturnsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Sub-permission
  const canProcessReturns = hasPermission(user, PERMISSIONS.MANAGE_RETURNS);

  // Search input and state
  const [invoiceIdQuery, setInvoiceIdQuery] = useState("");
  const [matchedInvoice, setMatchedInvoice] = useState<Invoice | null>(null);

  // Return quantities states
  const [refundQtyMap, setRefundQtyMap] = useState<{ [productId: string]: number }>({});
  const [refundReason, setRefundReason] = useState("");
  const [restockReturned, setRestockReturned] = useState(true);

  const handleSearchInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceIdQuery.trim()) {
      showToast("Por favor digite o escanee un número de factura.", "warning");
      return;
    }

    const allInvoices = getInvoices();
    const found = allInvoices.find(
      (inv) => inv.id.toLowerCase() === invoiceIdQuery.trim().toLowerCase()
    );

    if (found) {
      if (found.status === "REFUNDED") {
        showToast("Esta factura ya ha sido marcada como devuelta o anulada.", "warning");
      }
      setMatchedInvoice(found);
      
      // Initialize quantities map to 0 (default to no return)
      const initialQtys: { [productId: string]: number } = {};
      found.items.forEach((item) => {
        initialQtys[item.productId] = 0;
      });
      setRefundQtyMap(initialQtys);
      setRefundReason("Cambio o devolución por cliente");
    } else {
      showToast(`No se encontró ninguna factura con el número "${invoiceIdQuery}"`, "error");
      setMatchedInvoice(null);
    }
  };

  const handleProcessRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProcessReturns) {
      showToast("Permiso denegado: No tiene permisos para efectuar devoluciones o anulaciones.", "warning");
      return;
    }
    if (!matchedInvoice) return;

    // Filter items with quantities greater than 0
    const refundItems = matchedInvoice.items
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
      showToast("Debe seleccionar al menos un producto con cantidad mayor a cero.", "warning");
      return;
    }

    const totalRefunded = refundItems.reduce((sum, item) => sum + item.qty * item.price, 0);

    showConfirm({
      title: "Procesar Devolución",
      message: `¿Desea registrar esta devolución por valor de ${formatCOP(totalRefunded)}? Se generará un saldo a favor o reintegro y se ajustará el stock del inventario.`,
      confirmText: "Aplicar Devolución",
      severity: "warning",
      onConfirm: () => {
        registerRefund({
          invoiceId: matchedInvoice.id,
          items: refundItems,
          totalRefunded,
          restocked: restockReturned,
        });

        showToast("Devolución procesada y guardada correctamente.", "success");
        setMatchedInvoice(null);
        setInvoiceIdQuery("");
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-3xl mx-auto">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
          <RotateCcw className="w-5.5 h-5.5 text-indigo-600 animate-spin-slow" /> Módulo de Devoluciones de Caja
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Busque comprobantes de venta emitidos para procesar reintegros de mercancías defectuosas o canceladas, reabasteciendo el stock automáticamente.
        </p>
      </div>

      {/* SEARCH BOX FORM */}
      <form
        onSubmit={handleSearchInvoice}
        className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs flex items-center gap-3"
      >
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
          <Search className="w-5 h-5" />
        </div>
        
        <input
          type="text"
          placeholder="Escriba o escanee el número de factura origen (Ej: FV-1001)..."
          value={invoiceIdQuery}
          onChange={(e) => setInvoiceIdQuery(e.target.value)}
          className="flex-1 border border-slate-200 focus:outline-none focus:border-indigo-500 rounded-2xl px-4 py-2 text-xs font-mono font-bold tracking-tight bg-slate-50/50"
        />

        <button
          type="submit"
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
        >
          Buscar Factura
        </button>
      </form>

      {/* CONDITIONAL SECTIONS */}
      {!matchedInvoice ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400">
          <Receipt className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-xs font-semibold">Esperando código de factura</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
            Digite el número de factura impreso en el ticket de compra del cliente para desplegar los artículos habilitados para devolución.
          </p>
        </div>
      ) : (
        <form onSubmit={handleProcessRefund} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl flex flex-col gap-5 animate-zoom-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase">Factura Cargada: {matchedInvoice.id}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Cliente: {matchedInvoice.client.name} • Fecha: {new Date(matchedInvoice.createdAt).toLocaleDateString()}</p>
            </div>
            <button
              type="button"
              onClick={() => setMatchedInvoice(null)}
              className="text-slate-400 hover:text-slate-800 p-1"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Quantity Selector Table */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-2.5">
              Seleccione la cantidad de unidades a retornar
            </span>

            <div className="flex flex-col gap-2.5">
              {matchedInvoice.items.map((item) => (
                <div key={item.productId} className="p-3 border border-slate-100 rounded-2xl flex items-center justify-between text-xs hover:border-slate-200 transition-all">
                  <div>
                    <p className="font-bold text-slate-800">{item.name}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Original: {item.qty} u. x {formatCOP(item.price)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400">Retornar:</label>
                    <select
                      value={refundQtyMap[item.productId] || 0}
                      onChange={(e) => setRefundQtyMap({ ...refundQtyMap, [item.productId]: Number(e.target.value) })}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
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
          </div>

          {/* Observations Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Justificación de Devolución *</label>
              <input
                type="text"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                placeholder="Ej. Cambio de talla / Defecto de empaque"
              />
            </div>

            <div className="flex items-center pt-5 pl-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={restockReturned}
                  onChange={(e) => setRestockReturned(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5"
                />
                <span>Reingresar unidades devueltas al stock del inventario</span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMatchedInvoice(null)}
              className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canProcessReturns}
              title={!canProcessReturns ? "Permiso denegado: No tiene permisos para procesar devoluciones." : "Procesar Devolución"}
              className={`px-4 py-2 text-sm rounded-xl font-semibold transition-all flex items-center gap-1 ${
                !canProcessReturns
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none opacity-60"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
              }`}
            >
              <RotateCcw className="w-4 h-4" /> Procesar Devolución
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ReturnsPage;
