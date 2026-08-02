import React, { useState, useEffect, useMemo } from "react";
import {
  getAuditLogs,
  clearAuditLogs,
  exportAuditTrailCSV,
  exportAuditTrailPDF,
  AuditLogEntry,
  AuditCategory,
  AuditSeverity
} from "../../../services/auditLog.service";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { formatDateTimeCO } from "../../../utils/colombia";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  FileText,
  Trash2,
  RefreshCw,
  Info,
  AlertTriangle,
  RotateCcw,
  Package,
  Users,
  DollarSign,
  Key,
  Calendar,
  X,
  Code,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export const AuditTrailPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // State
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH">("ALL");

  // Selected Log for Inspector Modal
  const [inspectLog, setInspectLog] = useState<AuditLogEntry | null>(null);

  // Load audit logs
  const reloadLogs = () => {
    setLogs(getAuditLogs() || []);
  };

  useEffect(() => {
    reloadLogs();

    const handleUpdate = () => {
      reloadLogs();
    };

    window.addEventListener("softwork_audit_update", handleUpdate);
    return () => {
      window.removeEventListener("softwork_audit_update", handleUpdate);
    };
  }, []);

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesId = log.id.toLowerCase().includes(query);
        const matchesUser = log.userName.toLowerCase().includes(query) || log.userId.toLowerCase().includes(query);
        const matchesEntity = (log.entityName || "").toLowerCase().includes(query) || (log.entityId || "").toLowerCase().includes(query);
        const matchesDetails = log.details.toLowerCase().includes(query);
        const matchesAction = log.action.toLowerCase().includes(query);

        if (!matchesId && !matchesUser && !matchesEntity && !matchesDetails && !matchesAction) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== "ALL" && log.category !== selectedCategory) {
        return false;
      }

      // Severity filter
      if (selectedSeverity !== "ALL" && log.severity !== selectedSeverity) {
        return false;
      }

      // Date preset filter
      if (datePreset !== "ALL") {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (datePreset === "TODAY") {
          const isToday = logDate.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (datePreset === "WEEK") {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (datePreset === "MONTH") {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [logs, searchTerm, selectedCategory, selectedSeverity, datePreset]);

  // Metrics KPI calculations
  const totalEvents = logs.length;
  const criticalCount = logs.filter((l) => l.severity === "CRITICAL").length;
  const highCount = logs.filter((l) => l.severity === "HIGH").length;
  const salesVoidCount = logs.filter((l) => l.category === "SALES_VOID").length;
  const entryDeleteCount = logs.filter((l) => l.category === "ENTRY_DELETE").length;
  const inventoryModifyCount = logs.filter((l) => l.category === "INVENTORY_MODIFY").length;

  // Clear logs handler
  const handleClearLogs = () => {
    showConfirm({
      title: "Vaciar Historial de Auditoría",
      message: "¿Está seguro de que desea vaciar la bitácora de auditoría de seguridad? Esta acción es irreversible y eliminará todos los registros históricos.",
      confirmText: "Vaciar Bitácora",
      severity: "danger",
      onConfirm: () => {
        clearAuditLogs();
        showToast("La bitácora de auditoría ha sido vaciada.", "info");
      }
    });
  };

  // Category Icon & Badge helper
  const renderCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case "SALES_VOID":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <RotateCcw className="w-3 h-3 text-rose-500" /> Anulación Venta
          </span>
        );
      case "INVENTORY_MODIFY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <Package className="w-3 h-3 text-amber-500" /> Modif. Inventario
          </span>
        );
      case "ENTRY_DELETE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800">
            <Trash2 className="w-3 h-3 text-red-600" /> Borrado Registro
          </span>
        );
      case "PRICE_CHANGE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
            <DollarSign className="w-3 h-3 text-indigo-500" /> Cambio Precio
          </span>
        );
      case "USER_MANAGEMENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
            <Users className="w-3 h-3 text-sky-500" /> Gestión Usuarios
          </span>
        );
      case "SYSTEM_SECURITY":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Key className="w-3 h-3 text-slate-500" /> Seguridad
          </span>
        );
    }
  };

  // Severity Badge helper
  const renderSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-2xs flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Crítico
          </span>
        );
      case "HIGH":
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Alto
          </span>
        );
      case "MEDIUM":
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
            Medio
          </span>
        );
      case "INFO":
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Informativo
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      {/* Header & Main Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Bitácora de Auditoría y Seguridad
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supervisión forense y registro inmutable de acciones críticas (anulación de ventas, modificaciones de inventario y borrado de registros).
          </p>
        </div>

        {/* Global Export & Clear Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reloadLogs}
            className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Refrescar datos de auditoría"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              exportAuditTrailCSV(filteredLogs);
              showToast("Reporte de auditoría en CSV exportado con éxito.", "success");
            }}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/50 dark:border-emerald-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Exportar bitácora a formato CSV"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => {
              exportAuditTrailPDF(filteredLogs);
              showToast("Reporte de auditoría en PDF generado con éxito.", "success");
            }}
            className="px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/50 dark:border-rose-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Exportar reporte formal de auditoría a PDF"
          >
            <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Exportar PDF
          </button>

          {user?.role === "ADMIN" && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/60 dark:border-rose-800/40 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Vaciar bitácora de auditoría"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI METRICS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Eventos Registrados
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {totalEvents}
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              En almacenamiento inmutable
            </span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Critical & High Events */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 dark:text-rose-400">
              Acciones Severas / Críticas
            </span>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {criticalCount + highCount}
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              {criticalCount} críticas, {highCount} de alta prioridad
            </span>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/40">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Sales Voided */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Anulación de Ventas
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {salesVoidCount}
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              Auditoría de devoluciones
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/40">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>

        {/* Inventory & Deletions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ajustes y Borrados
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {inventoryModifyCount + entryDeleteCount}
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              {inventoryModifyCount} inventario, {entryDeleteCount} eliminaciones
            </span>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-sky-900/40">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID audit, usuario, entidad (ej. Factura, Producto), acción o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 placeholder:text-slate-400"
          />
        </div>

        {/* Category & Severity Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Categorías</option>
              <option value="SALES_VOID">Anulación de Ventas</option>
              <option value="INVENTORY_MODIFY">Modificación de Inventario</option>
              <option value="ENTRY_DELETE">Borrado de Registros</option>
              <option value="PRICE_CHANGE">Cambio de Precios</option>
              <option value="USER_MANAGEMENT">Gestión de Usuarios</option>
              <option value="SYSTEM_SECURITY">Seguridad y Accesos</option>
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Cualquier Gravedad</option>
              <option value="CRITICAL">Crítico</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="INFO">Informativo</option>
            </select>
          </div>

          {/* Date Preset Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setDatePreset("ALL")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                datePreset === "ALL"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("TODAY")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                datePreset === "TODAY"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("WEEK")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                datePreset === "WEEK"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              7 Días
            </button>
          </div>
        </div>
      </div>

      {/* AUDIT LOG EVENTS TABLE / LIST */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              Registro Continuo de Actividades
            </h3>
            <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40">
              {filteredLogs.length} eventos listados
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Ordenado cronológicamente (más recientes primero)
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No se encontraron registros de auditoría para estos filtros
            </p>
            <p className="text-xs text-center max-w-sm">
              Pruebe cambiando los términos de búsqueda, la categoría o el nivel de gravedad seleccionado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-x-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Left Info: ID, Time, Operator, Category */}
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                      {log.id}
                    </span>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDateTimeCO(log.timestamp)}
                    </span>

                    {renderCategoryBadge(log.category)}
                    {renderSeverityBadge(log.severity)}
                  </div>

                  {/* Details Description */}
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                    {log.details}
                  </p>

                  {/* Previous / New State Pill */}
                  {(log.previousState || log.newState) && (
                    <div className="flex flex-wrap items-center gap-2 text-[10px] mt-1 font-mono">
                      {log.previousState && (
                        <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-800/40">
                          Antes: {log.previousState}
                        </span>
                      )}
                      {log.newState && (
                        <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                          Ahora: {log.newState}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Operator & Entity Footer */}
                  <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>
                      Operario: <strong className="text-slate-700 dark:text-slate-300">{log.userName}</strong> ({log.userId})
                    </span>
                    <span>•</span>
                    <span>
                      Rol: <strong className="text-indigo-600 dark:text-indigo-400">{log.userRole}</strong>
                    </span>
                    {log.entityName && (
                      <>
                        <span>•</span>
                        <span>
                          Entidad: <strong className="text-slate-800 dark:text-slate-200">{log.entityName}</strong>
                        </span>
                      </>
                    )}
                    {log.ipAddress && (
                      <>
                        <span>•</span>
                        <span>IP/Terminal: {log.ipAddress}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Action: Inspect Payload */}
                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => setInspectLog(log)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/60 dark:border-slate-700/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Code className="w-3.5 h-3.5 text-indigo-500" /> Inspeccionar JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TECHNICAL INSPECTOR MODAL */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    Inspección Técnica de Auditoría
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    ID Registro: {inspectLog.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* General Specs */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Timestamp</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                  {formatDateTimeCO(inspectLog.timestamp)}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Terminal IP</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                  {inspectLog.ipAddress || "192.168.1.10"}
                </span>
              </div>
            </div>

            {/* Payload JSON */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Estructura de Datos Bruta (JSON)
              </label>
              <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-3 rounded-xl overflow-x-auto border border-slate-800 max-h-60">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer"
              >
                Cerrar Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrailPage;
