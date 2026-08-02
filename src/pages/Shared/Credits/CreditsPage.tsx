import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { getClients, saveClients, Client } from "../../../services/client.service";
import { getInvoices, Invoice } from "../../../services/invoice.service";
import { formatCOP, formatDateCO } from "../../../utils/colombia";
import {
  CreditCard,
  Search,
  DollarSign,
  TrendingDown,
  Clock,
  History,
  AlertCircle,
  FileCheck,
  ChevronDown,
  X,
  FileText
} from "lucide-react";

export const CreditsPage: React.FC = () => {
  const { showToast, showConfirm } = useUiFeedback();
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");

  // Payment Modal
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  // Client Details panel
  const [activeDetailsClient, setActiveDetailsClient] = useState<Client | null>(null);

  const loadData = () => {
    setClients(getClients());
    setInvoices(getInvoices());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter clients who have an active debt or a credit limit assigned
  const creditClients = useMemo(() => {
    return clients.filter((c) => {
      const matchText = c.name.toLowerCase().includes(search.toLowerCase()) || c.nitOrCc.includes(search);
      const isCreditEnabled = c.creditLimit > 0;
      return matchText && isCreditEnabled;
    });
  }, [clients, search]);

  // Outstanding credit invoices for selected client details
  const clientCreditInvoices = useMemo(() => {
    if (!activeDetailsClient) return [];
    return invoices.filter(
      (inv) => inv.client.id === activeDetailsClient.id && inv.paymentMethod === "CREDIT"
    );
  }, [invoices, activeDetailsClient]);

  // Overall statistics
  const totals = useMemo(() => {
    const activeCreditClients = clients.filter((c) => c.creditLimit > 0);
    const totalAssignedLimit = activeCreditClients.reduce((sum, c) => sum + c.creditLimit, 0);
    const totalOutstandingDebt = clients.reduce((sum, c) => sum + c.creditBalance, 0);
    const availableCredit = Math.max(0, totalAssignedLimit - totalOutstandingDebt);

    return {
      totalAssignedLimit,
      totalOutstandingDebt,
      availableCredit,
    };
  }, [clients]);

  const openPaymentModal = (client: Client) => {
    setSelectedClient(client);
    setPaymentAmount(client.creditBalance); // default to pay full debt
    setPaymentOpen(true);
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    if (paymentAmount <= 0) {
      showToast("La cantidad del abono debe ser mayor a cero.", "error");
      return;
    }

    if (paymentAmount > selectedClient.creditBalance) {
      showToast("El monto del abono no puede superar la deuda total activa.", "warning");
      return;
    }

    showConfirm({
      title: "Confirmar Abono",
      message: `¿Desea registrar un abono de ${formatCOP(paymentAmount)} a la cuenta de "${selectedClient.name}"?`,
      confirmText: "Registrar Abono",
      severity: "info",
      onConfirm: () => {
        const storedClients = getClients();
        const updated = storedClients.map((c) => {
          if (c.id === selectedClient.id) {
            c.creditBalance = Math.max(0, c.creditBalance - paymentAmount);
          }
          return c;
        });
        saveClients(updated);

        // Append payment event or adjustment log if needed (session state handles balances)
        showToast(
          `Abono de ${formatCOP(paymentAmount)} aplicado con éxito. Saldo deudor restante: ${formatCOP(
            Math.max(0, selectedClient.creditBalance - paymentAmount)
          )}`,
          "success"
        );
        
        setPaymentOpen(false);
        setSelectedClient(null);
        
        // Refresh details if visible
        if (activeDetailsClient?.id === selectedClient.id) {
          const refreshed = updated.find((c) => c.id === selectedClient.id);
          setActiveDetailsClient(refreshed || null);
        }
        
        loadData();
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Title & Headline */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
          <CreditCard className="w-5.5 h-5.5 text-indigo-600" /> Cuentas por Cobrar y Créditos
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Supervise los créditos activos, consulte historiales de facturas financiadas y registre abonos parciales o totales.
        </p>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total limit */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cupo Financiero Autorizado</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(totals.totalAssignedLimit)}
            </h3>
          </div>
        </div>

        {/* Total outstanding debt */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deuda Pendiente (Por Cobrar)</span>
            <h3 className="text-lg font-black text-rose-600 tracking-tight mt-0.5">
              {formatCOP(totals.totalOutstandingDebt)}
            </h3>
          </div>
        </div>

        {/* Available credit */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cupo de Crédito Disponible</span>
            <h3 className="text-lg font-black text-emerald-600 tracking-tight mt-0.5">
              {formatCOP(totals.availableCredit)}
            </h3>
          </div>
        </div>
      </div>

      {/* SEARCH AND MAIN TABLE SPLIT SCREEN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 cols: Debtor clients table */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-4">
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                placeholder="Buscar clientes por nombre o NIT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                    <th className="py-3 px-6">Identificación</th>
                    <th className="py-3 px-6">Cliente</th>
                    <th className="py-3 px-6 text-right">Cupo Límite</th>
                    <th className="py-3 px-6 text-right">Saldo Deudor</th>
                    <th className="py-3 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {creditClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 font-medium">
                        No hay clientes con cupo de crédito vigentes.
                      </td>
                    </tr>
                  ) : (
                    creditClients.map((c) => {
                      const hasActiveDebt = c.creditBalance > 0;
                      const isSelected = activeDetailsClient?.id === c.id;

                      return (
                        <tr
                          key={c.id}
                          onClick={() => setActiveDetailsClient(c)}
                          className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors ${
                            isSelected ? "bg-indigo-50/20 hover:bg-indigo-50/30" : ""
                          }`}
                        >
                          <td className="py-4 px-6 font-mono font-bold text-slate-800">{c.nitOrCc}</td>
                          <td className="py-4 px-6 font-semibold text-slate-900">{c.name}</td>
                          <td className="py-4 px-6 text-right text-slate-500 font-medium">
                            {formatCOP(c.creditLimit)}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={`font-bold ${hasActiveDebt ? "text-rose-600" : "text-emerald-600"}`}>
                              {formatCOP(c.creditBalance)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              {hasActiveDebt ? (
                                <button
                                  onClick={() => openPaymentModal(c)}
                                  className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-lg shadow-sm transition-all"
                                >
                                  Abonar Deuda
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <FileCheck className="w-3.5 h-3.5" /> Al día
                                </span>
                              )}
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
        </div>

        {/* Right 1 col: Selected client credit details */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-6 flex flex-col gap-4">
          {!activeDetailsClient ? (
            <div className="text-center py-16 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-xs font-semibold">Seleccione un cliente</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                Haga clic sobre un registro de la lista de la izquierda para ver su historial detallado de facturación de crédito.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    {activeDetailsClient.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 mt-1 block">CC/NIT: {activeDetailsClient.nitOrCc}</span>
                </div>
                <button
                  onClick={() => setActiveDetailsClient(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Balances summary */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Cupo Total</span>
                  <span className="text-xs font-bold text-slate-700">{formatCOP(activeDetailsClient.creditLimit)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Saldo Pendiente</span>
                  <span className="text-xs font-black text-rose-600">
                    {formatCOP(activeDetailsClient.creditBalance)}
                  </span>
                </div>
              </div>

              {/* Linked credit invoice list */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-500" /> Facturas Pendientes
                </h5>

                {clientCreditInvoices.length === 0 ? (
                  <p className="text-[10px] text-slate-400 py-6 text-center">
                    No registra facturas activas financiadas a crédito.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {clientCreditInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 border border-slate-100 rounded-xl hover:border-slate-200 transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{inv.id}</p>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            Fecha: {formatDateCO(inv.createdAt)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-extrabold text-slate-900">{formatCOP(inv.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REGISTRATION OF CREDIT PAYMENT MODAL */}
      {paymentOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" /> Aplicar Abono a Crédito
              </h3>
              <button onClick={() => setPaymentOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="p-6 flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Abono para</span>
                <p className="text-sm font-extrabold text-slate-900 mt-1">{selectedClient.name}</p>
                <span className="text-xs text-rose-600 font-bold block mt-1">
                  Deuda Pendiente: {formatCOP(selectedClient.creditBalance)}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Monto del Abono (COP) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={100}
                    max={selectedClient.creditBalance}
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-bold text-slate-900"
                    placeholder="Ingrese valor del pago"
                  />
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">$</span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-1.5 leading-snug">
                  * El abono reducirá el saldo deudor del cliente y se ajustarán las cuentas por cobrar generales de la cartera comercial.
                </span>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Aplicar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditsPage;
