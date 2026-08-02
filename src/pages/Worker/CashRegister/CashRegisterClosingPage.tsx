import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { hasPermission } from "../../../utils/permissions";
import { PERMISSIONS } from "../../../permissions/PermissionConstants";
import { getInvoices, getExpenses, recordCashRegisterClosure, CashRegisterClosure } from "../../../services/invoice.service";
import { formatCOP } from "../../../utils/colombia";
import { ROUTES } from "../../../shared/constants";
import {
  Coins,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  FileText,
  LogOut,
  X,
  Lock,
  Wallet
} from "lucide-react";

export const CashRegisterClosingPage: React.FC = () => {
  const { user, logoutUser } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();
  const navigate = useNavigate();

  // Sub-permission check
  const canCloseCash = hasPermission(user, PERMISSIONS.CLOSE_CASH_REGISTER);

  // Load daily live data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Starting base cash drawer (standard Colombian retail cash base: $150,000 COP)
  const baseCash = 150000;

  // physical cash input by cashier
  const [physicalCash, setPhysicalCash] = useState<number>(0);

  // Closing observations
  const [notes, setNotes] = useState("");

  const loadData = () => {
    setInvoices(getInvoices());
    setExpenses(getExpenses());
  };

  useEffect(() => {
    loadData();
    // Default physical cash to base cash for quick onboarding
    setPhysicalCash(baseCash);
  }, []);

  // Compute exact shift aggregates
  const shiftMetrics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];

    // Filter invoices billed today
    const activeInvoices = invoices.filter(
      (inv) => inv.status !== "REFUNDED" && inv.createdAt.split("T")[0] === today
    );

    // Filter cash expenses today
    const activeExpenses = expenses.filter(
      (exp) => exp.createdAt.split("T")[0] === today && exp.paymentMethod === "CASH"
    );

    const cashSales = activeInvoices
      .filter((inv) => inv.paymentMethod === "CASH")
      .reduce((sum, inv) => sum + inv.total, 0);

    const electronicSales = activeInvoices
      .filter((inv) => inv.paymentMethod === "CARD" || inv.paymentMethod === "NEQUI_DAVIPLATA")
      .reduce((sum, inv) => sum + inv.total, 0);

    const creditSales = activeInvoices
      .filter((inv) => inv.paymentMethod === "CREDIT")
      .reduce((sum, inv) => sum + inv.total, 0);

    const cashExpenses = activeExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Expected Cash = Base Cash + Cash Sales - Cash Expenses
    const expectedCash = baseCash + cashSales - cashExpenses;

    return {
      cashSales,
      electronicSales,
      creditSales,
      cashExpenses,
      expectedCash,
    };
  }, [invoices, expenses]);

  // Shortage/Overage check calculations
  const cashDifference = useMemo(() => {
    return physicalCash - shiftMetrics.expectedCash;
  }, [physicalCash, shiftMetrics.expectedCash]);

  const handleProcessClosing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCloseCash) {
      showToast("Permiso denegado: No tiene permisos para efectuar el cierre de caja.", "warning");
      return;
    }

    const diffStatus =
      cashDifference === 0
        ? "CUADRADO"
        : cashDifference > 0
        ? "SOBRANTE"
        : "FALTANTE";

    const summaryText =
      diffStatus === "CUADRADO"
        ? "Caja cuadrada perfectamente."
        : `${diffStatus} de ${formatCOP(Math.abs(cashDifference))}`;

    showConfirm({
      title: "Confirmar Arqueo de Caja",
      message: `¿Está seguro de que desea realizar el cierre de caja del turno actual? Se registrará un arqueo con ${summaryText} y se cerrará su sesión activa de inmediato.`,
      confirmText: "Efectuar Cierre de Caja",
      severity: (cashDifference === 0 ? "info" : "warning") as "info" | "warning",
      onConfirm: () => {
        // Register Closing record
        recordCashRegisterClosure({
          closedBy: user?.id || "usr-cajero",
          closedByName: user?.name || "Cajero",
          openedAt: new Date().toISOString(),
          openingBalance: baseCash,
          cashSales: shiftMetrics.cashSales,
          cardSales: 0,
          electronicSales: shiftMetrics.electronicSales,
          creditSales: shiftMetrics.creditSales,
          totalSales: shiftMetrics.cashSales + shiftMetrics.electronicSales + shiftMetrics.creditSales,
          cashExpenses: shiftMetrics.cashExpenses,
          expectedCashInBox: shiftMetrics.expectedCash,
          countedCash: physicalCash,
          countedCard: 0,
          countedElectronic: shiftMetrics.electronicSales,
          cashDiscrepancy: cashDifference,
          observations: notes.trim() || "Cierre de turno estándar.",
          status: "COMPLETED",
        });

        showToast(`Cierre de caja registrado exitosamente (${summaryText}). Cerrando sesión de seguridad...`, "success");
        
        // Log out user securely
        setTimeout(() => {
          logoutUser();
          navigate(ROUTES.LOGIN);
        }, 1000);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
          <Lock className="w-5.5 h-5.5 text-indigo-600 animate-pulse" /> Arqueo y Cierre de Caja POS
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Registre las cantidades físicas de dinero en la gaveta. El software cotejará la diferencia matemática con la facturación y los egresos de caja registrados hoy.
        </p>
      </div>

      <form onSubmit={handleProcessClosing} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 columns: Audit values table */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col gap-4">
            <h3 className="text-sm font-black text-slate-950">Resumen Financiero del Turno</h3>
            
            <div className="flex flex-col gap-3.5 text-xs text-slate-600">
              
              {/* Base cash */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="font-semibold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-400" /> Base Inicial de Caja
                </span>
                <span className="font-bold text-slate-900">{formatCOP(baseCash)}</span>
              </div>

              {/* Cash Sales */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="font-semibold flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Ventas Facturadas en Efectivo (+)
                </span>
                <span className="font-bold text-emerald-600">+{formatCOP(shiftMetrics.cashSales)}</span>
              </div>

              {/* Cash expenses */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="font-semibold flex items-center gap-2 text-rose-500">
                  <TrendingDown className="w-4 h-4 text-rose-400" /> Egresos / Gastos de Caja Menor (-)
                </span>
                <span className="font-bold text-rose-500">-{formatCOP(shiftMetrics.cashExpenses)}</span>
              </div>

              {/* Expected cash */}
              <div className="flex justify-between items-center py-3 bg-slate-50 border border-slate-100 px-4 rounded-xl mt-2">
                <span className="font-black text-slate-800 uppercase tracking-wider text-[10px]">
                  Efectivo Esperado en Caja
                </span>
                <span className="font-black text-slate-950 text-sm">
                  {formatCOP(shiftMetrics.expectedCash)}
                </span>
              </div>

              {/* Non-cash electronic sales for context info */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-400 mt-2">
                <span className="font-medium">Ventas Tarjeta / Nequi / Daviplata (Bancos)</span>
                <span>{formatCOP(shiftMetrics.electronicSales)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-400">
                <span className="font-medium">Créditos Otorgados (Cartera Comercial)</span>
                <span>{formatCOP(shiftMetrics.creditSales)}</span>
              </div>
            </div>
          </div>

          {/* Observations textbox */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-700 block">Novedades u Observaciones del Cierre</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              placeholder="Ej. Se recibió un billete roto que fue reportado al administrador, o caja cuadrada perfectamente."
            />
          </div>
        </div>

        {/* Right 1 column: Physical input and difference checks */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl flex flex-col gap-5 text-center">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mx-auto mb-1">
            <Coins className="w-8 h-8 animate-bounce-slow" />
          </div>

          <div>
            <h4 className="text-sm font-black text-slate-900 leading-tight">Arqueo Manual Físico</h4>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
              Ingrese el total de billetes y monedas que posee físicamente en el cajón de efectivo.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Efectivo Físico Total *</label>
            <div className="relative">
              <input
                type="number"
                required
                min={0}
                value={physicalCash || ""}
                onChange={(e) => setPhysicalCash(Math.max(0, Number(e.target.value)))}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-black text-center text-slate-900 bg-slate-50/50"
              />
              <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-xs">$</span>
            </div>
          </div>

          {/* AUDIT DIFFERENCE RESULTS */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Cotejo / Diferencia</span>
            
            {cashDifference === 0 ? (
              <div className="mt-2 text-emerald-600 font-black text-xs flex items-center justify-center gap-1">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> Caja Cuadrada
              </div>
            ) : cashDifference > 0 ? (
              <div className="mt-2 text-indigo-600 font-black text-xs flex flex-col items-center gap-1">
                <span className="flex items-center gap-0.5"><TrendingUp className="w-4.5 h-4.5 text-indigo-500" /> Sobrante de Caja</span>
                <span className="text-sm font-black">{formatCOP(cashDifference)}</span>
              </div>
            ) : (
              <div className="mt-2 text-rose-600 font-black text-xs flex flex-col items-center gap-1">
                <span className="flex items-center gap-0.5"><AlertTriangle className="w-4.5 h-4.5 text-rose-500 animate-pulse" /> Faltante de Caja</span>
                <span className="text-sm font-black">{formatCOP(cashDifference)}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canCloseCash}
            title={!canCloseCash ? "Permiso denegado: No tiene permiso para cerrar caja." : "Registrar Cierre de Turno"}
            className={`w-full py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              !canCloseCash
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none opacity-60"
                : "bg-slate-900 hover:bg-slate-800 text-white shadow-md cursor-pointer"
            }`}
          >
            <LogOut className="w-4 h-4" /> Registrar Cierre de Turno
          </button>
        </div>
      </form>
    </div>
  );
};

export default CashRegisterClosingPage;
