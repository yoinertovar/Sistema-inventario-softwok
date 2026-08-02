import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { getClients, upsertClient, deleteClient, Client } from "../../../services/client.service";
import { formatCOP } from "../../../utils/colombia";
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  CreditCard,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  AlertTriangle
} from "lucide-react";

export const ClientsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [debtFilter, setDebtFilter] = useState<"all" | "debtors" | "clean">("all");

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  // Form State & Validation
  const [form, setForm] = useState({
    id: "",
    name: "",
    nitOrCc: "",
    phone: "",
    email: "",
    address: "",
    creditLimit: 0,
    creditBalance: 0,
    active: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const validateForm = (formData = form) => {
    const errors: Record<string, string> = {};

    // 1. Name
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = "El nombre o razón social es obligatorio.";
    } else if (trimmedName.length < 3) {
      errors.name = "El nombre debe contener al menos 3 caracteres.";
    } else if (/^\d+$/.test(trimmedName)) {
      errors.name = "El nombre no puede componerse únicamente de números.";
    }

    // 2. NIT / CC
    const trimmedNit = formData.nitOrCc.trim();
    if (!trimmedNit) {
      errors.nitOrCc = "El documento (CC o NIT) es obligatorio.";
    } else if (trimmedNit.length < 5) {
      errors.nitOrCc = "El documento/NIT debe tener al menos 5 caracteres.";
    } else if (!/^[a-zA-Z0-9\s.-]+$/.test(trimmedNit)) {
      errors.nitOrCc = "El documento solo puede incluir números, letras, puntos y guiones.";
    } else {
      const duplicate = clients.find(
        (c) => c.nitOrCc.toLowerCase() === trimmedNit.toLowerCase() && c.id !== activeClient?.id
      );
      if (duplicate) {
        errors.nitOrCc = `Ya existe un cliente con este documento/NIT (${duplicate.name}).`;
      }
    }

    // 3. Email
    const trimmedEmail = formData.email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Formato de correo no válido (ejemplo: cliente@empresa.com).";
    }

    // 4. Phone
    const trimmedPhone = formData.phone.trim();
    if (trimmedPhone) {
      const digitsOnly = trimmedPhone.replace(/\D/g, "");
      if (digitsOnly.length < 7) {
        errors.phone = "El número telefónico debe tener al menos 7 dígitos.";
      }
    }

    // 5. Credit Limit
    if (formData.creditLimit < 0) {
      errors.creditLimit = "El cupo de crédito no puede ser negativo.";
    } else if (formData.creditLimit > 1000000000) {
      errors.creditLimit = "El cupo máximo permitido es de $1,000,000,000 COP.";
    }

    // 6. Credit Balance
    if (formData.creditBalance < 0) {
      errors.creditBalance = "El saldo deudor no puede ser un valor negativo.";
    } else if (formData.creditLimit > 0 && formData.creditBalance > formData.creditLimit) {
      errors.creditBalance = `El saldo deudor no puede superar el cupo ($${formData.creditLimit.toLocaleString("es-CO")}).`;
    }

    return errors;
  };

  const loadData = () => {
    setClients(getClients());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const query = search.toLowerCase();
      const matchesQuery =
        c.name.toLowerCase().includes(query) ||
        c.nitOrCc.includes(query) ||
        c.phone.includes(query) ||
        c.email.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && c.active) ||
        (statusFilter === "inactive" && !c.active);

      const matchesDebt =
        debtFilter === "all" ||
        (debtFilter === "debtors" && c.creditBalance > 0) ||
        (debtFilter === "clean" && c.creditBalance <= 0);

      return matchesQuery && matchesStatus && matchesDebt;
    });
  }, [clients, search, statusFilter, debtFilter]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, debtFilter]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredClients.length / itemsPerPage) || 1;
  }, [filteredClients, itemsPerPage]);

  const paginatedClients = useMemo(() => {
    const validPage = Math.min(currentPage, totalPages);
    const start = (validPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage, totalPages]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = clients.length;
    const debtorCount = clients.filter((c) => c.creditBalance > 0).length;
    const totalOutstandingDebt = clients.reduce((sum, c) => sum + c.creditBalance, 0);

    return {
      totalCount,
      debtorCount,
      totalOutstandingDebt,
    };
  }, [clients]);

  const openModal = (client: Client | null = null) => {
    setFormErrors({});
    setTouchedFields({});
    setSubmitAttempted(false);

    if (client) {
      setActiveClient(client);
      setForm({ ...client });
    } else {
      setActiveClient(null);
      setForm({
        id: "",
        name: "",
        nitOrCc: "",
        phone: "",
        email: "",
        address: "",
        creditLimit: 0,
        creditBalance: 0,
        active: true,
      });
    }
    setModalOpen(true);
  };

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (submitAttempted || touchedFields[field]) {
      const errors = validateForm(updated);
      setFormErrors(errors);
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const errors = validateForm(form);
    setFormErrors(errors);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast("Existen campos con errores de validación. Revise el formulario.", "error");
      return;
    }

    const updated = upsertClient({
      ...form,
      name: form.name.trim(),
      nitOrCc: form.nitOrCc.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      creditLimit: Number(form.creditLimit),
      creditBalance: Number(form.creditBalance),
    });

    showToast(
      `Cliente "${updated.name}" ${activeClient ? "actualizado" : "creado"} correctamente.`,
      "success"
    );
    setModalOpen(false);
    loadData();
  };

  const handleDelete = (client: Client) => {
    if (client.id === "cli-consumidor") {
      showToast("No se puede eliminar la cuenta general del público 'Consumidor Final'.", "error");
      return;
    }

    if (client.creditBalance > 0) {
      showToast("No se puede eliminar un cliente que posee un saldo deudor pendiente.", "warning");
      return;
    }

    showConfirm({
      title: "Eliminar Cliente",
      message: `¿Está seguro de que desea eliminar permanentemente a "${client.name}" de la base de datos comercial?`,
      confirmText: "Eliminar",
      severity: "danger",
      onConfirm: () => {
        deleteClient(client.id);
        showToast("Cliente removido correctamente.", "success");
        loadData();
      },
    });
  };

  // Export current filtered clients list to CSV
  const handleExportCSV = () => {
    try {
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const headers = [
        "NIT/CC",
        "Nombre",
        "Celular",
        "Correo Electrónico",
        "Dirección",
        "Cupo Límite",
        "Saldo Deudor",
        "Estado",
        "Fecha Creación"
      ];

      const rows = filteredClients.map((c) => [
        c.nitOrCc,
        c.name,
        c.phone || "",
        c.email || "",
        c.address || "",
        c.creditLimit,
        c.creditBalance,
        c.active ? "Activo" : "Inactivo",
        c.createdAt || ""
      ]);

      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(","))
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `reporte_clientes_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Reporte de clientes exportado correctamente.", "success");
    } catch (error) {
      showToast("Error al exportar los datos a CSV.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            <Users className="w-5.5 h-5.5 text-indigo-600" /> Registro General de Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de clientes, cupos de crédito comercial y registro unificado de cuentas por cobrar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "ADMIN" && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-1.5"
              title="Exportar vista actual a formato CSV"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          )}

          <button
            onClick={() => openModal(null)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Registrar Cliente
          </button>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total clients */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Clientes</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {stats.totalCount} Registrados
            </h3>
          </div>
        </div>

        {/* Clients with Debt */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuentas Activas</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {stats.debtorCount} Clientes Deudores
            </h3>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cartera de Crédito</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(stats.totalOutstandingDebt)}
            </h3>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Text input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nombre, identificación o celular..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === "active"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === "inactive"
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Inactivos
              </button>
            </div>

            {/* Debt Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setDebtFilter("all")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  debtFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Todos los Créditos
              </button>
              <button
                onClick={() => setDebtFilter("debtors")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  debtFilter === "debtors"
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Con Deuda
              </button>
              <button
                onClick={() => setDebtFilter("clean")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  debtFilter === "clean"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Sin Deuda
              </button>
            </div>
          </div>

          {/* Quick Stats or clear filters button */}
          <div className="flex items-center gap-3 text-xs justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <span className="text-slate-500 font-bold">
              Encontrados: <strong className="text-indigo-600 font-extrabold">{filteredClients.length}</strong>
            </span>
            {(search || statusFilter !== "all" || debtFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setDebtFilter("all");
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold rounded-lg transition-all flex items-center gap-1"
                title="Limpiar todos los filtros aplicados"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CLIENTS DATA LIST TABLE */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                <th className="py-3.5 px-6">Identificación (NIT/CC)</th>
                <th className="py-3.5 px-6">Razón Social / Nombre</th>
                <th className="py-3.5 px-6">Contacto</th>
                <th className="py-3.5 px-6">Dirección</th>
                <th className="py-3.5 px-6 text-right">Cupo Límite</th>
                <th className="py-3.5 px-6 text-right">Saldo Deudor</th>
                <th className="py-3.5 px-6 text-center">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    No se encontraron clientes registrados que coincidan.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((c) => {
                  const hasDebt = c.creditBalance > 0;
                  const usageRate = c.creditLimit > 0 ? (c.creditBalance / c.creditLimit) * 100 : 0;

                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 tracking-tight">
                        {c.nitOrCc}
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800 leading-tight">{c.name}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">Reg: {new Date(c.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          {c.phone !== "N/A" && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 opacity-60" /> {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span className="flex items-center gap-1 text-[11px] opacity-80">
                              <Mail className="w-3 h-3 opacity-60" /> {c.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {c.address ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 opacity-60 shrink-0" /> {c.address}
                          </span>
                        ) : (
                          "No registrada"
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-500">
                        {c.creditLimit > 0 ? formatCOP(c.creditLimit) : "Venta Contado"}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-bold ${hasDebt ? "text-rose-600" : "text-slate-900"}`}>
                            {formatCOP(c.creditBalance)}
                          </span>
                          {c.creditLimit > 0 && hasDebt && (
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              {usageRate.toFixed(0)}% del cupo total
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {c.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openModal(c)}
                            className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-slate-400 transition-all"
                            title="Editar Datos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            disabled={c.id === "cli-consumidor"}
                            className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Eliminar Cliente"
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

        {/* PAGINATION CONTROLS */}
        {filteredClients.length > 0 && (
          <div className="bg-white border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Mostrar</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-500 text-slate-700"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>clientes por página</span>
              <span className="mx-2 text-slate-300">|</span>
              <span>
                Mostrando <strong className="font-semibold text-slate-800">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredClients.length)}</strong> al <strong className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredClients.length)}</strong> de <strong className="font-semibold text-slate-800">{filteredClients.length}</strong> clientes
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                if (
                  totalPages <= 5 ||
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === page
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "border border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  (page === 2 && currentPage > 3) ||
                  (page === totalPages - 1 && currentPage < totalPages - 2)
                ) {
                  return (
                    <span key={page} className="text-slate-400 text-xs px-1 select-none">
                      ...
                    </span>
                  );
                }
                return null;
              })}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
                title="Siguiente Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CLIENT ADD/EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {activeClient ? "Modificar Ficha Cliente" : "Registrar Nuevo Cliente"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              {/* Validation Alert Summary */}
              {submitAttempted && Object.keys(formErrors).length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-800 dark:text-rose-200">
                    <strong className="font-bold block mb-0.5">Corrige los errores antes de guardar:</strong>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {Object.values(formErrors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Name field */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nombre Completo o Razón Social *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  onBlur={() => handleFieldBlur("name")}
                  className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                    formErrors.name && (touchedFields.name || submitAttempted)
                      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                  }`}
                  placeholder="Ej. Juan Pérez o Inversiones Alfa"
                />
                {formErrors.name && (touchedFields.name || submitAttempted) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{formErrors.name}</span>
                  </div>
                )}
              </div>

              {/* Document/NIT & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Documento / NIT *
                  </label>
                  <input
                    type="text"
                    value={form.nitOrCc}
                    onChange={(e) => handleFieldChange("nitOrCc", e.target.value)}
                    onBlur={() => handleFieldBlur("nitOrCc")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      formErrors.nitOrCc && (touchedFields.nitOrCc || submitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="Ej. 1015432..."
                  />
                  {formErrors.nitOrCc && (touchedFields.nitOrCc || submitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{formErrors.nitOrCc}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Celular de Contacto
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    onBlur={() => handleFieldBlur("phone")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      formErrors.phone && (touchedFields.phone || submitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="Ej. 31544..."
                  />
                  {formErrors.phone && (touchedFields.phone || submitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{formErrors.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  onBlur={() => handleFieldBlur("email")}
                  className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                    formErrors.email && (touchedFields.email || submitAttempted)
                      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                  }`}
                  placeholder="ejemplo@correo.com"
                />
                {formErrors.email && (touchedFields.email || submitAttempted) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{formErrors.email}</span>
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Dirección de Envío / Entrega
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                  placeholder="Calle, avenida o barrio..."
                />
              </div>

              <div className="w-px h-1" />

              {/* Credit limits settings */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block">
                  Configuración Financiera (Crédito)
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Cupo de Crédito (COP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.creditLimit || ""}
                      onChange={(e) => handleFieldChange("creditLimit", Math.max(0, Number(e.target.value)))}
                      onBlur={() => handleFieldBlur("creditLimit")}
                      className={`w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ${
                        formErrors.creditLimit && (touchedFields.creditLimit || submitAttempted)
                          ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                          : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                      }`}
                      placeholder="0 = Sin Crédito"
                    />
                    {formErrors.creditLimit && (touchedFields.creditLimit || submitAttempted) && (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                        <AlertCircle className="w-3 h-3 shrink-0 text-rose-500 dark:text-rose-400" />
                        <span>{formErrors.creditLimit}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Saldo Deudor Actual
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.creditBalance || ""}
                      onChange={(e) => handleFieldChange("creditBalance", Math.max(0, Number(e.target.value)))}
                      onBlur={() => handleFieldBlur("creditBalance")}
                      className={`w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ${
                        formErrors.creditBalance && (touchedFields.creditBalance || submitAttempted)
                          ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                          : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                      }`}
                      placeholder="Cantidad de deuda"
                    />
                    {formErrors.creditBalance && (touchedFields.creditBalance || submitAttempted) && (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                        <AlertCircle className="w-3 h-3 shrink-0 text-rose-500 dark:text-rose-400" />
                        <span>{formErrors.creditBalance}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
