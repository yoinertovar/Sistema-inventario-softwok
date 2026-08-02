import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getAuditLogs, AuditLogEntry, AuditCategory } from "../../../../services/auditLog.service";
import { ROUTES } from "../../../../shared/constants";
import { formatDateTimeCO } from "../../../../utils/colombia";
import {
  ShieldAlert,
  ArrowUpRight,
  RotateCcw,
  Package,
  Trash2,
  DollarSign,
  Users,
  Key,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export const AuditTrailDashboardWidget: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

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

  // Top 5 most recent logs
  const recentLogs = useMemo(() => {
    return [...logs].slice(0, 5);
  }, [logs]);

  // Counts
  const criticalCount = useMemo(() => {
    return logs.filter((l) => l.severity === "CRITICAL" || l.severity === "HIGH").length;
  }, [logs]);

  // Render badge helper
  const renderMiniCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case "SALES_VOID":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 shrink-0">
            <RotateCcw className="w-2.5 h-2.5 text-rose-500" /> Anulación
          </span>
        );
      case "INVENTORY_MODIFY":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 shrink-0">
            <Package className="w-2.5 h-2.5 text-amber-500" /> Stock
          </span>
        );
      case "ENTRY_DELETE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 shrink-0">
            <Trash2 className="w-2.5 h-2.5 text-red-600" /> Borrado
          </span>
        );
      case "PRICE_CHANGE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
            <DollarSign className="w-2.5 h-2.5 text-indigo-500" /> Precio
          </span>
        );
      case "USER_MANAGEMENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40 shrink-0">
            <Users className="w-2.5 h-2.5 text-sky-500" /> Usuario
          </span>
        );
      case "SYSTEM_SECURITY":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 shrink-0">
            <Key className="w-2.5 h-2.5 text-slate-500" /> Seguridad
          </span>
        );
    }
  };

  return (
    <div id="audit-trail-dashboard-widget" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-xs p-5 flex flex-col gap-4 h-full transition-colors duration-150">
      {/* Widget Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Trazabilidad y Auditoría de Seguridad
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Registro en tiempo real de operaciones sensibles y cambios de catálogo.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reloadLogs}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Refrescar auditoría"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            {criticalCount} Alertas Críticas
          </span>
        </div>
      </div>

      {/* Live Stream List */}
      <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 flex flex-col gap-2">
        {recentLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2 h-full text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Sin eventos de auditoría registrados
            </p>
          </div>
        ) : (
          recentLogs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-800/30 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                    {log.id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDateTimeCO(log.timestamp)}
                  </span>
                </div>
                {renderMiniCategoryBadge(log.category)}
              </div>

              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                {log.details}
              </p>

              <div className="flex items-center justify-between text-[9.5px] text-slate-400 dark:text-slate-500 pt-0.5">
                <span>
                  Operario: <strong className="text-slate-700 dark:text-slate-300">{log.userName}</strong>
                </span>
                {log.severity === "CRITICAL" && (
                  <span className="text-rose-600 dark:text-rose-400 font-black flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> Evento Crítico
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer link to full audit page */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between mt-auto">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          Registro inmutable local
        </span>

        <Link
          to={ROUTES.AUDIT_TRAIL}
          className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-all"
        >
          Ver Historial Completo <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
