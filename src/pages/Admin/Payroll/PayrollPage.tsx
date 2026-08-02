import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../utils/permissions";
import { PERMISSIONS } from "../../../permissions/PermissionConstants";
import { getUsers, saveUsers, User } from "../../../services/user.service";
import { getInvoices, upsertExpense } from "../../../services/invoice.service";
import { formatCOP } from "../../../utils/colombia";
import { COMPANY_CONFIG } from "../../../config/config";
import { jsPDF } from "jspdf";
import {
  Users,
  Percent,
  Coins,
  History,
  TrendingUp,
  CreditCard,
  Briefcase,
  Award,
  Wallet,
  Settings,
  X,
  FileCheck,
  DollarSign,
  FileDown
} from "lucide-react";

export const PayrollPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Sub-permissions
  const canManageWorkers = hasPermission(user, PERMISSIONS.MANAGE_WORKERS);
  const canRecordPayment = hasPermission(user, PERMISSIONS.RECORD_PAYMENT);

  const [workers, setWorkers] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Adjustment Modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null);
  const [baseSalaryInput, setBaseSalaryInput] = useState(1300000);
  const [commissionInput, setCommissionInput] = useState(2);

  const loadData = () => {
    // Only load non-admin or all workers to compute payrolls
    const allUsers = getUsers();
    setWorkers(allUsers.filter((u) => u.active));
    setInvoices(getInvoices());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute live payroll list
  const workerPayrolls = useMemo(() => {
    return workers.map((worker) => {
      // Find all invoices processed by this specific seller
      const processedSales = invoices.filter(
        (inv) => inv.sellerName.toLowerCase() === worker.name.toLowerCase() && inv.status !== "REFUNDED"
      );

      const totalSalesVolume = processedSales.reduce((sum, inv) => sum + inv.total, 0);
      const commissionRate = worker.commissionRate || 2; // default to 2% commission if not set
      const baseSalary = worker.baseSalary || 1300000; // default Colombian minimum wage reference

      const commissionEarned = (totalSalesVolume * commissionRate) / 100;
      const totalPayrollLiquid = baseSalary + commissionEarned;

      return {
        worker,
        totalSalesVolume,
        commissionRate,
        baseSalary,
        commissionEarned,
        totalPayrollLiquid,
        salesCount: processedSales.length,
      };
    });
  }, [workers, invoices]);

  // Overall statistics
  const payrollTotals = useMemo(() => {
    const totalBase = workerPayrolls.reduce((sum, wp) => sum + wp.baseSalary, 0);
    const totalCommissions = workerPayrolls.reduce((sum, wp) => sum + wp.commissionEarned, 0);
    const totalPayrollPaid = totalBase + totalCommissions;

    return {
      totalBase,
      totalCommissions,
      totalPayrollPaid,
    };
  }, [workerPayrolls]);

  const openAdjustmentModal = (wp: any) => {
    if (!canManageWorkers) {
      showToast("Permiso denegado: No tiene permisos para gestionar parámetros de colaboradores.", "warning");
      return;
    }
    setSelectedWorker(wp.worker);
    setBaseSalaryInput(wp.baseSalary);
    setCommissionInput(wp.commissionRate);
    setAdjustOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageWorkers) {
      showToast("Permiso denegado: No tiene permisos para modificar salarios o comisiones.", "error");
      return;
    }
    if (!selectedWorker) return;

    const storedUsers = getUsers();
    const updated = storedUsers.map((u) => {
      if (u.id === selectedWorker.id) {
        u.baseSalary = Number(baseSalaryInput);
        u.commissionRate = Number(commissionInput);
      }
      return u;
    });
    saveUsers(updated);

    showToast(`Parámetros de nómina para "${selectedWorker.name}" ajustados.`, "success");
    setAdjustOpen(false);
    setSelectedWorker(null);
    loadData();
  };

  const handleLiquidatePayroll = (wp: any) => {
    if (!canRecordPayment) {
      showToast("Permiso denegado: No tiene permisos para liquidar y registrar pagos de nómina.", "warning");
      return;
    }
    showConfirm({
      title: "Liquidar y Pagar Nómina",
      message: `¿Desea asentar el pago de nómina para "${wp.worker.name}" por un valor neto de ${formatCOP(
        wp.totalPayrollLiquid
      )}? Se registrará un egreso oficial de caja bajo la categoría "Nómina".`,
      confirmText: "Liquidar Nómina",
      severity: "info",
      onConfirm: () => {
        // Register payroll outlay in expenses
        upsertExpense({
          id: "",
          category: "Nómina",
          description: `Liquidación nómina periodo actual: ${wp.worker.name} (Base: ${formatCOP(
            wp.baseSalary
          )} + Comisiones: ${formatCOP(wp.commissionEarned)})`,
          amount: wp.totalPayrollLiquid,
          paymentMethod: "TRANSFER",
          createdAt: new Date().toISOString(),
        });

        showToast(`Pago de nómina para "${wp.worker.name}" asentado y debitado de bancos.`, "success");
        loadData();
      },
    });
  };

  const generateSalarySlipPdf = (wp: any) => {
    try {
      // Load customized bizConfig if available
      const savedConfig = localStorage.getItem("softwork_company_config");
      const company = savedConfig ? JSON.parse(savedConfig) : COMPANY_CONFIG;

      // Initialize jsPDF document
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Colors
      const primaryColor = [79, 70, 229]; // #4F46E5 (Indigo 600)
      const secondaryColor = [71, 85, 105]; // #475569 (Slate 600)
      const lightBg = [248, 250, 252]; // #F8FAFC (Slate 50)
      const darkText = [15, 23, 42]; // #0F172A (Slate 900)
      const borderLineColor = [226, 232, 240]; // #E2E8F0 (Slate 200)

      // Start page header
      let y = 15;

      // Draw top decoration line (primary color)
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 5, "F");

      // Company Name
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(company.name.toUpperCase(), 15, y);
      y += 5;

      // Company Details
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`NIT: ${company.nit}`, 15, y);
      y += 4.5;
      doc.text(`Dirección: ${company.address}`, 15, y);
      y += 4.5;
      doc.text(`Teléfono: ${company.phone} | Email: ${company.email}`, 15, y);
      y += 10;

      // Document Title Header Box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, y, 180, 14, "F");
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.rect(15, y, 180, 14, "S");

      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DESPRENDIBLE DE PAGO DE NÓMINA", 20, y + 9);

      const voucherNo = `NOM-${new Date().getFullYear()}-${wp.worker.id.substring(0, 5).toUpperCase()}`;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`No. Comprobante: ${voucherNo}`, 130, y + 6);
      doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 130, y + 10);
      y += 20;

      // Employee Information Block
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, y, 180, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("INFORMACIÓN DEL COLABORADOR", 20, y + 4.5);
      y += 6;

      // Information box border
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.rect(15, y, 180, 24, "S");

      // Details inside box
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.setFont("helvetica", "bold");
      doc.text("Nombre Empleado:", 20, y + 6);
      doc.setFont("helvetica", "normal");
      doc.text(wp.worker.name, 55, y + 6);

      doc.setFont("helvetica", "bold");
      doc.text("Cargo / Rol:", 20, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text(wp.worker.role === "ADMIN" ? "Administrador" : "Cajero Operador", 55, y + 12);

      doc.setFont("helvetica", "bold");
      doc.text("Identificación:", 20, y + 18);
      doc.setFont("helvetica", "normal");
      doc.text(wp.worker.email, 55, y + 18); // fallback to email/id info

      // Right column of info box
      doc.setFont("helvetica", "bold");
      doc.text("Sueldo Básico:", 120, y + 6);
      doc.setFont("helvetica", "normal");
      doc.text(formatCOP(wp.baseSalary), 155, y + 6);

      doc.setFont("helvetica", "bold");
      doc.text("Tasa Comisión:", 120, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text(`${wp.commissionRate}%`, 155, y + 12);

      doc.setFont("helvetica", "bold");
      doc.text("Ventas Facturadas:", 120, y + 18);
      doc.setFont("helvetica", "normal");
      doc.text(`${wp.salesCount} facturas`, 155, y + 18);

      y += 32;

      // Concept table
      // Header for concepts
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, y, 180, 8, "F");
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.rect(15, y, 180, 8, "S");

      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("CONCEPTO / DETALLE", 20, y + 5.5);
      doc.text("DEVENGADOS (+)", 100, y + 5.5);
      doc.text("DEDUCCIONES (-)", 145, y + 5.5);
      y += 8;

      // Table Row 1: Base Salary
      doc.rect(15, y, 180, 8, "S");
      doc.setFont("helvetica", "normal");
      doc.text("Sueldo Básico del Periodo", 20, y + 5.5);
      doc.text(formatCOP(wp.baseSalary), 100, y + 5.5);
      doc.text("$0", 145, y + 5.5);
      y += 8;

      // Table Row 2: Commissions
      doc.rect(15, y, 180, 8, "S");
      doc.text(`Comisión por Ventas Realizadas (${wp.commissionRate}%)`, 20, y + 5.5);
      doc.text(formatCOP(wp.commissionEarned), 100, y + 5.5);
      doc.text("$0", 145, y + 5.5);
      y += 8;

      // Table Row 3: Health EPS
      doc.rect(15, y, 180, 8, "S");
      doc.text("Salud EPS (Soporte / Descuentos)", 20, y + 5.5);
      doc.text("$0", 100, y + 5.5);
      doc.text("$0", 145, y + 5.5);
      y += 8;

      // Table Row 4: Pension
      doc.rect(15, y, 180, 8, "S");
      doc.text("Pensión Obligatoria (Colpensiones/Fondo)", 20, y + 5.5);
      doc.text("$0", 100, y + 5.5);
      doc.text("$0", 145, y + 5.5);
      y += 12;

      // Totals Box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(110, y, 85, 26, "F");
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.rect(110, y, 85, 26, "S");

      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.text("Total Devengado:", 115, y + 6);
      doc.setFont("helvetica", "normal");
      doc.text(formatCOP(wp.baseSalary + wp.commissionEarned), 160, y + 6);

      doc.setFont("helvetica", "bold");
      doc.text("Total Deducciones:", 115, y + 12);
      doc.setFont("helvetica", "normal");
      doc.text("$0", 160, y + 12);

      // Horizontal separator in total box
      doc.setDrawColor(borderLineColor[0], borderLineColor[1], borderLineColor[2]);
      doc.line(115, y + 16, 190, y + 16);

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("NETO PAGADO:", 115, y + 22);
      doc.text(formatCOP(wp.totalPayrollLiquid), 160, y + 22);

      y += 40;

      // Signatures
      doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

      // Employer Line
      doc.line(20, y, 85, y);
      doc.text("Firma del Empleador / Representante", 20, y + 4.5);
      doc.text("SoftWork Solutions S.A.S.", 20, y + 8.5);

      // Employee Line
      doc.line(120, y, 185, y);
      doc.text("Recibí Conforme (Firma Empleado)", 120, y + 4.5);
      doc.text(`C.C. / ID: ______________________`, 120, y + 8.5);

      y += 30;

      // Footer disclaimer
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Este documento constituye una representación y constancia del pago de honorarios, sueldos y comisiones de venta.",
        105,
        y,
        { align: "center" }
      );
      doc.text(
        "Generado de forma automática por la Plataforma SoftWork POS el " + new Date().toLocaleString() + ".",
        105,
        y + 3.5,
        { align: "center" }
      );

      // Save PDF
      const fileName = `volante_nomina_${wp.worker.name.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      showToast(`Desprendible de pago para "${wp.worker.name}" descargado en PDF.`, "success");
    } catch (err: any) {
      console.error("Error generating PDF:", err);
      showToast("Error al generar el volante de nómina en PDF.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
          <Coins className="w-5.5 h-5.5 text-indigo-600 animate-bounce-slow" /> Liquidación de Nómina y Comisiones
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Liquide sueldos básicos y comisiones de ventas de sus colaboradores basadas en su volumen real de facturación del periodo actual.
        </p>
      </div>

      {/* PAYROLL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Salaries */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sueldos Básicos Totales</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(payrollTotals.totalBase)}
            </h3>
          </div>
        </div>

        {/* Total commissions */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comisiones de Venta Estimadas</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(payrollTotals.totalCommissions)}
            </h3>
          </div>
        </div>

        {/* Net payout liquidation */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gasto Neto en Nómina</span>
            <h3 className="text-lg font-black text-rose-600 tracking-tight mt-0.5">
              {formatCOP(payrollTotals.totalPayrollPaid)}
            </h3>
          </div>
        </div>
      </div>

      {/* WORKERS LIST TABLE */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                <th className="py-3.5 px-6">Trabajador / Rol</th>
                <th className="py-3.5 px-6 text-right">Sueldo Básico (COP)</th>
                <th className="py-3.5 px-6 text-center">Tasa Comisión</th>
                <th className="py-3.5 px-6 text-center">Ventas Realizadas</th>
                <th className="py-3.5 px-6 text-right">Volumen Facturado</th>
                <th className="py-3.5 px-6 text-right">Comisiones Ganadas</th>
                <th className="py-3.5 px-6 text-right font-bold text-indigo-700">Neto a Liquidar</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {workerPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    No hay colaboradores activos en nómina actualmente.
                  </td>
                </tr>
              ) : (
                workerPayrolls.map((wp) => {
                  return (
                    <tr key={wp.worker.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800 leading-tight">{wp.worker.name}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block uppercase font-bold tracking-wider">
                          {wp.worker.role === "ADMIN" ? "Administrador" : "Cajero Operador"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-500">
                        {formatCOP(wp.baseSalary)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                          {wp.commissionRate}%
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center text-slate-500 font-semibold">
                        {wp.salesCount} facturas
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-800">
                        {formatCOP(wp.totalSalesVolume)}
                      </td>
                      <td className="py-4 px-6 text-right font-semibold text-amber-600">
                        {formatCOP(wp.commissionEarned)}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-indigo-600">
                        {formatCOP(wp.totalPayrollLiquid)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => generateSalarySlipPdf(wp)}
                            className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-slate-400 transition-all"
                            title="Descargar Desprendible (PDF)"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openAdjustmentModal(wp)}
                            disabled={!canManageWorkers}
                            title={!canManageWorkers ? "Permiso denegado: No tiene permisos para ajustar parámetros de nómina." : "Ajustar Parámetros"}
                            className={`p-1.5 rounded-lg transition-all ${
                              !canManageWorkers
                                ? "text-slate-300 cursor-not-allowed opacity-50"
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            }`}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleLiquidatePayroll(wp)}
                            disabled={!canRecordPayment}
                            title={!canRecordPayment ? "Permiso denegado: No tiene permisos para pagar nómina." : "Pagar Nómina"}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                              !canRecordPayment
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none opacity-60"
                                : "text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-sm cursor-pointer"
                            }`}
                          >
                            <FileCheck className="w-3.5 h-3.5" /> Pagar
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

      {/* ADJUSTMENT SETTINGS MODAL */}
      {adjustOpen && selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-indigo-600 animate-spin-slow" /> Configuración Nómina
              </h3>
              <button onClick={() => setAdjustOpen(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Colaborador</span>
                <p className="text-sm font-extrabold text-slate-950 mt-0.5">{selectedWorker.name}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Salario Básico Mensual (COP) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={0}
                    value={baseSalaryInput}
                    onChange={(e) => setBaseSalaryInput(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-bold text-slate-900"
                  />
                  <span className="absolute left-3.5 top-2 text-slate-400 font-bold text-xs">$</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tasa de Comisión por Ventas (%) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    step={0.1}
                    min={0}
                    max={25}
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-4 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-bold text-slate-900"
                  />
                  <span className="absolute right-3.5 top-2 text-slate-400 font-bold text-xs">%</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1.5 leading-relaxed">
                  * El cajero recibirá un bono equivalente a este porcentaje sobre todas sus facturas aprobadas cobradas.
                </span>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Aplicar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPage;
