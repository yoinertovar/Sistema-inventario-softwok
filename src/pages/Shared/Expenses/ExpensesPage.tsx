import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../utils/permissions";
import { PERMISSIONS } from "../../../permissions/PermissionConstants";
import { getExpenses, upsertExpense, deleteExpense, Expense } from "../../../services/invoice.service";
import { formatCOP, formatDateCO } from "../../../utils/colombia";
import {
  DollarSign,
  Plus,
  Search,
  Trash2,
  Edit2,
  TrendingDown,
  CreditCard,
  Wallet,
  Receipt,
  AlertCircle,
  X,
  Calendar
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Arriendo",
  "Servicios Públicos",
  "Nómina",
  "Papelería",
  "Mantenimiento",
  "Otros",
] as const;

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Sub-permissions
  const canCreateExpense = hasPermission(user, PERMISSIONS.CREATE_EXPENSE);
  const canEditExpense = hasPermission(user, PERMISSIONS.EDIT_EXPENSE);
  const canDeleteExpense = hasPermission(user, PERMISSIONS.DELETE_EXPENSE);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState<Expense | null>(null);

  // Form State
  const [form, setForm] = useState({
    id: "",
    category: "Servicios Públicos" as Expense["category"],
    description: "",
    amount: 0,
    paymentMethod: "CASH" as Expense["paymentMethod"],
  });

  const loadData = () => {
    setExpenses(getExpenses());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const query = search.toLowerCase();
      return (
        e.category.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query) ||
        e.paymentMethod.toLowerCase().includes(query)
      );
    });
  }, [expenses, search]);

  // Calculations
  const stats = useMemo(() => {
    const totalCount = expenses.length;
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const cashExpenses = expenses.filter((e) => e.paymentMethod === "CASH").reduce((sum, e) => sum + e.amount, 0);
    const electronicExpenses = expenses.filter((e) => e.paymentMethod !== "CASH").reduce((sum, e) => sum + e.amount, 0);

    return {
      totalCount,
      totalAmount,
      cashExpenses,
      electronicExpenses,
    };
  }, [expenses]);

  const openModal = (expense: Expense | null = null) => {
    if (expense) {
      if (!canEditExpense) {
        showToast("Permiso denegado: No tiene permisos para modificar gastos.", "warning");
        return;
      }
      setActiveExpense(expense);
      setForm({ ...expense });
    } else {
      if (!canCreateExpense) {
        showToast("Permiso denegado: No tiene permisos para registrar nuevos gastos.", "warning");
        return;
      }
      setActiveExpense(null);
      setForm({
        id: "",
        category: "Servicios Públicos",
        description: "",
        amount: 0,
        paymentMethod: "CASH",
      });
    }
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeExpense && !canEditExpense) {
      showToast("Permiso denegado: No tiene permisos para editar gastos.", "error");
      return;
    }
    if (!activeExpense && !canCreateExpense) {
      showToast("Permiso denegado: No tiene permisos para registrar gastos.", "error");
      return;
    }
    if (!form.description.trim()) {
      showToast("Por favor escriba una descripción o motivo para el egreso.", "error");
      return;
    }
    if (form.amount <= 0) {
      showToast("El monto del gasto debe ser mayor que cero.", "error");
      return;
    }

    const updated = upsertExpense({
      ...form,
      amount: Number(form.amount),
    });

    showToast(
      `Gasto por ${formatCOP(updated.amount)} registrado exitosamente.`,
      "success"
    );
    setModalOpen(false);
    loadData();
  };

  const handleDelete = (expense: Expense) => {
    if (!canDeleteExpense) {
      showToast("Permiso denegado: No tiene permisos para eliminar registros de gastos.", "warning");
      return;
    }
    showConfirm({
      title: "Eliminar Registro de Gasto",
      message: `¿Está seguro de que desea eliminar permanentemente este egreso de ${formatCOP(
        expense.amount
      )} registrado como "${expense.description}"?`,
      confirmText: "Eliminar Egresos",
      severity: "danger",
      onConfirm: () => {
        deleteExpense(expense.id);
        showToast("Registro de gasto removido correctamente.", "success");
        loadData();
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            <DollarSign className="w-5.5 h-5.5 text-rose-500" /> Registro y Control de Gastos (Egresos)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestione las salidas de caja menor, pagos operacionales, recibos de servicios públicos y arriendos.
          </p>
        </div>

        <button
          onClick={() => openModal(null)}
          disabled={!canCreateExpense}
          title={!canCreateExpense ? "Permiso denegado: No tiene permisos para registrar gastos." : "Registrar Egreso"}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
            !canCreateExpense
              ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed opacity-60"
              : "text-white bg-rose-600 hover:bg-rose-700 shadow-rose-600/10 cursor-pointer"
          }`}
        >
          <Plus className="w-4 h-4" /> Registrar Egreso
        </button>
      </div>

      {/* STATS DE GASTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total expenses */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Egresos Histórico</span>
            <h3 className="text-lg font-black text-rose-600 tracking-tight mt-0.5">
              {formatCOP(stats.totalAmount)}
            </h3>
          </div>
        </div>

        {/* Cash expenses */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salidas de Caja Menor</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(stats.cashExpenses)}
            </h3>
          </div>
        </div>

        {/* Transfer/Electronic expenses */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Egresos por Bancos/Transferencia</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(stats.electronicExpenses)}
            </h3>
          </div>
        </div>
      </div>

      {/* SEARCH CONTROL CARD */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Buscar por motivo, categoría o método..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </div>
      </div>

      {/* EXPENSE DATA TABLE */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                <th className="py-3.5 px-6">ID Egreso</th>
                <th className="py-3.5 px-6">Categoría</th>
                <th className="py-3.5 px-6">Descripción / Motivo</th>
                <th className="py-3.5 px-6">Fecha Registro</th>
                <th className="py-3.5 px-6">Método Salida</th>
                <th className="py-3.5 px-6 text-right">Monto de Gasto</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    No se registran egresos ni gastos operacionales aún.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => {
                  return (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">{e.id}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">{e.description}</td>
                      <td className="py-4 px-6 text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 opacity-60" /> {formatDateCO(e.createdAt)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-semibold">
                        {e.paymentMethod === "CASH" ? "Caja Menor (Efectivo)" : e.paymentMethod === "TRANSFER" ? "Transferencia Bancaria" : "Tarjeta Débito/Crédito"}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-rose-600">
                        {formatCOP(e.amount)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openModal(e)}
                            disabled={!canEditExpense}
                            title={!canEditExpense ? "Permiso denegado: No tiene permisos para editar gastos." : "Editar Datos"}
                            className={`p-1.5 rounded-lg transition-all ${
                              !canEditExpense
                                ? "text-slate-300 cursor-not-allowed opacity-50"
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(e)}
                            disabled={!canDeleteExpense}
                            title={!canDeleteExpense ? "Permiso denegado: No tiene permisos para eliminar gastos." : "Remover Registro"}
                            className={`p-1.5 rounded-lg transition-all ${
                              !canDeleteExpense
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

      {/* EXPENSE REGISTRATION MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-rose-500" />
                {activeExpense ? "Editar Egreso Registrado" : "Registrar Comprobante de Egreso"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Categoría del Gasto</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descripción / Motivo Detallado *</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500"
                  placeholder="Ej. Pago recibo del agua acueducto junio"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Monto del Egreso *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={100}
                      value={form.amount || ""}
                      onChange={(e) => setForm({ ...form, amount: Math.max(0, Number(e.target.value)) })}
                      className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500 font-bold"
                    />
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">$</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Medio de Pago</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as Expense["paymentMethod"] })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500"
                  >
                    <option value="CASH">Efectivo (Caja Menor)</option>
                    <option value="CARD">Tarjeta Débito/Crédito</option>
                    <option value="TRANSFER">Transferencia Bancaria</option>
                  </select>
                </div>
              </div>

              {form.paymentMethod === "CASH" && (
                <div className="flex gap-2.5 p-3 rounded-xl border border-amber-100 bg-amber-50 text-[11px] text-amber-800 leading-snug">
                  <AlertCircle className="w-5.5 h-5.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Atención:</strong> Las salidas en Efectivo afectan directamente el arqueo de caja de la jornada diaria en el arqueo final.
                  </span>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Guardar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
