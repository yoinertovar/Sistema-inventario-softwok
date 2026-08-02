import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { getRefunds, getInvoices, Refund } from "../../../services/invoice.service";
import { formatCOP, formatDateCO } from "../../../utils/colombia";
import { exportRefundsCSV, exportRefundsPDF } from "../../../utils/exportReports";
import {
  History,
  Search,
  RotateCcw,
  CheckCircle,
  TrendingDown,
  User,
  Calendar,
  AlertCircle,
  FileX,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText
} from "lucide-react";

export const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useUiFeedback();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [search, setSearch] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadData = () => {
    setRefunds(getRefunds());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter returns
  const filteredRefunds = useMemo(() => {
    return refunds.filter((ref) => {
      const q = search.toLowerCase();
      return (
        ref.id.toLowerCase().includes(q) ||
        ref.invoiceId.toLowerCase().includes(q) ||
        ref.items.some((item) => item.name.toLowerCase().includes(q) || item.reason.toLowerCase().includes(q))
      );
    });
  }, [refunds, search]);

  // Reset page to 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredRefunds.length / itemsPerPage) || 1;
  }, [filteredRefunds, itemsPerPage]);

  const paginatedRefunds = useMemo(() => {
    const validPage = Math.min(currentPage, totalPages);
    const start = (validPage - 1) * itemsPerPage;
    return filteredRefunds.slice(start, start + itemsPerPage);
  }, [filteredRefunds, currentPage, itemsPerPage, totalPages]);

  // General statistics of refund costs
  const totalRefundValue = useMemo(() => {
    return refunds.reduce((sum, r) => sum + r.totalRefunded, 0);
  }, [refunds]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Page Title & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
            <History className="w-5.5 h-5.5 text-indigo-600 dark:text-indigo-400" /> Historial de Devoluciones y Auditoría
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consulte la auditoría completa de mercancía reingresada, devoluciones liquidadas y justificaciones de saldos devueltos.
          </p>
        </div>

        {/* Export Buttons for Admins */}
        {user?.role === "ADMIN" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                exportRefundsCSV(filteredRefunds);
                showToast("Reporte de devoluciones en CSV exportado con éxito.", "success");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/50 dark:border-emerald-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Exportar reporte de devoluciones a formato CSV"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Exportar CSV
            </button>

            <button
              type="button"
              onClick={() => {
                exportRefundsPDF(filteredRefunds);
                showToast("Reporte de devoluciones en PDF generado con éxito.", "success");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/50 dark:border-rose-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Exportar reporte contable de devoluciones a formato PDF"
            >
              <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY CARD */}
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <RotateCcw className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dinero Devuelto</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(totalRefundValue)}
            </h3>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Saldos descontados de la facturación bruta comercial
            </span>
          </div>
        </div>

        <div className="text-right text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
          Devoluciones: <span className="text-slate-900 font-bold">{refunds.length} casos</span>
        </div>
      </div>

      {/* SEARCH BOX */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Buscar por ID devolución, factura o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </div>
      </div>

      {/* REFUNDS TIMELINE CARDS */}
      <div className="flex flex-col gap-4">
        {filteredRefunds.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 font-medium">
            <FileX className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            No se registran transacciones de devoluciones o reintegros.
          </div>
        ) : (
          <>
            {paginatedRefunds.map((ref) => (
              <div
                key={ref.id}
                className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-200 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-50 text-rose-500 rounded-xl shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">{ref.id}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">• Factura de Origen: {ref.invoiceId}</span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 opacity-60" /> {formatDateCO(ref.createdAt)}
                    </p>

                    {/* List items inside refund */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ref.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-slate-50 border border-slate-100 text-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <PackageCheck className="w-3.5 h-3.5 text-indigo-500" />
                          {item.name} ({item.qty} u.) - <span className="italic text-slate-400">"{item.reason}"</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-50 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Monto Reintegrado</span>
                  <span className="text-sm font-black text-rose-600 block mt-0.5">
                    {formatCOP(ref.totalRefunded)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full mt-1.5 ${
                      ref.restocked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <CheckCircle className="w-3 h-3" />
                    {ref.restocked ? "Reingresado a Stock" : "Sin Reingreso"}
                  </span>
                </div>
              </div>
            ))}

            {/* PAGINATION CONTROLS */}
            <div className="bg-white border border-slate-100 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
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
                <span>devoluciones por página</span>
                <span className="mx-2 text-slate-300">|</span>
                <span>
                  Mostrando <strong className="font-semibold text-slate-800">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredRefunds.length)}</strong> al <strong className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredRefunds.length)}</strong> de <strong className="font-semibold text-slate-800">{filteredRefunds.length}</strong> devoluciones
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer bg-white"
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
                            : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
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
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer bg-white"
                  title="Siguiente Página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
