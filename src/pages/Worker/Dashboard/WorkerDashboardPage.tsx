import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useSmartWorkspace } from "../../../context/SmartWorkspaceContext";
import { getInvoices } from "../../../services/invoice.service";
import { formatCOP } from "../../../utils/colombia";
import { ROUTES } from "../../../shared/constants";
import {
  ShoppingBag,
  CreditCard,
  PlusCircle,
  Receipt,
  LogOut,
  Award,
  TrendingUp,
  Coins,
  BadgeAlert,
  ArrowRight
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

export const WorkerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { workspaces } = useSmartWorkspace();

  // Load live invoices to filter sales processed by this worker today
  const workerStats = useMemo(() => {
    if (!user) {
      return {
        totalSales: 0,
        salesCount: 0,
        hourlyData: [],
        paymentMethodData: []
      };
    }
    const allInvoices = getInvoices();
    
    // Filter non-refunded invoices billed by this cashier today
    const today = new Date().toISOString().split("T")[0];
    const userInvoices = allInvoices.filter(
      (inv) =>
        inv.sellerName.toLowerCase() === user.name.toLowerCase() &&
        inv.status !== "REFUNDED" &&
        inv.createdAt.split("T")[0] === today
    );

    const totalSales = userInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Prepare hourly data (e.g. 08:00 to 20:00)
    const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    const hourlyMap: { [key: string]: number } = {};
    hours.forEach((h) => { hourlyMap[h] = 0; });

    userInvoices.forEach((inv) => {
      const dateObj = new Date(inv.createdAt);
      const hour = dateObj.getHours();
      let bracket = "08:00";
      if (hour >= 20) bracket = "20:00";
      else if (hour >= 18) bracket = "18:00";
      else if (hour >= 16) bracket = "16:00";
      else if (hour >= 14) bracket = "14:00";
      else if (hour >= 12) bracket = "12:00";
      else if (hour >= 10) bracket = "10:00";
      else bracket = "08:00";

      hourlyMap[bracket] += inv.total;
    });

    const hourlyData = hours.map((h) => ({
      hour: h,
      Ventas: hourlyMap[h]
    }));

    // Prepare Payment Method Distribution
    const pmNames: { [key: string]: string } = {
      CASH: "Efectivo",
      CARD: "Tarjeta",
      NEQUI_DAVIPLATA: "Nequi/Daviplata",
      CREDIT: "Crédito"
    };

    const pmCounts: { [key: string]: number } = {
      CASH: 0,
      CARD: 0,
      NEQUI_DAVIPLATA: 0,
      CREDIT: 0
    };

    userInvoices.forEach((inv) => {
      if (pmCounts[inv.paymentMethod] !== undefined) {
        pmCounts[inv.paymentMethod] += inv.total;
      }
    });

    const paymentMethodData = Object.keys(pmCounts)
      .map((key) => ({
        name: pmNames[key],
        value: pmCounts[key]
      }))
      .filter((item) => item.value > 0);

    return {
      totalSales,
      salesCount: userInvoices.length,
      hourlyData,
      paymentMethodData
    };
  }, [user]);

  // Motivational daily goal calculation (Colombia retail context: standard $500,000 COP cashier target)
  const dailyTarget = 500000;
  const progressPercent = useMemo(() => {
    const rate = (workerStats.totalSales / dailyTarget) * 100;
    return Math.min(100, Math.round(rate));
  }, [workerStats.totalSales]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 rounded-3xl p-6 text-white shadow-lg border border-indigo-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Abstract background blobs */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
        
        <div>
          <span className="text-[10px] bg-indigo-500/25 border border-indigo-500/40 text-indigo-200 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Sesión de Turno Activa
          </span>
          <h2 className="text-xl font-black tracking-tight mt-3">
            ¡Hola, {user?.name}!
          </h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-md">
            Bienvenido a tu panel de caja. Listo para facturar ventas, registrar cobros e ingresar arqueos de cierre de caja.
          </p>
        </div>

        <Link
          to={ROUTES.WORKSPACE}
          className="px-5 py-3 rounded-2xl bg-white text-indigo-950 text-xs font-black hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <ShoppingBag className="w-4 h-4 text-indigo-600" /> Iniciar Terminal POS <ArrowRight className="w-4 h-4 text-indigo-600" />
        </Link>
      </div>

      {/* WORKER DASH STATS METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today sales total */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tus Ventas de Hoy</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {formatCOP(workerStats.totalSales)}
            </h3>
          </div>
        </div>

        {/* Invoice sales count */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas Emitidas</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {workerStats.salesCount} Ventas
            </h3>
          </div>
        </div>

        {/* Running terminal tabs */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <ShoppingBag className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mesas/Cuentas Abiertas</span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              {workspaces.length} Clientes en Atención
            </h3>
          </div>
        </div>
      </div>

      {/* PERFORMANCE & MOTIVATION PROGRESS METER */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Award className="w-5 h-5 text-indigo-600" /> Tu Meta de Venta Diaria
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Comisión de ventas activa. Cumple tu cuota diaria para asegurar bonos operacionales.
            </p>
          </div>
          <span className="text-xs font-black text-slate-900">
            {progressPercent}% Completado
          </span>
        </div>

        {/* Progress bar container */}
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
          <span>Logrado: {formatCOP(workerStats.totalSales)}</span>
          <span className="text-indigo-600">Meta: {formatCOP(dailyTarget)}</span>
        </div>
      </div>

      {/* VISUAL ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Hourly Sales performance */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Tu Rendimiento Horario de Hoy</h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Ingresos acumulados por franja horaria durante tu turno.</p>
          </div>

          <div className="h-60 w-full">
            {workerStats.salesCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 gap-2 font-semibold">
                <span>Registra tu primera venta en el POS para visualizar la gráfica</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={workerStats.hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="workerSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: any) => [`$${value.toLocaleString()}`, "Ventas"]}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none" }}
                    labelStyle={{ color: "#fff", fontWeight: "bold" }}
                    itemStyle={{ color: "#818cf8" }}
                  />
                  <Area type="monotone" dataKey="Ventas" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#workerSalesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sales by payment method */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Ventas por Método de Pago</h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Distribución de tu facturación actual. Útil para cuadre de caja.</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center relative">
            {workerStats.salesCount === 0 ? (
              <div className="text-xs text-slate-400 font-semibold text-center">
                Sin datos de pago aún (factura una venta para ver el balance)
              </div>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={workerStats.paymentMethodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {workerStats.paymentMethodData.map((entry, index) => {
                          const colors = ["#10b981", "#3b82f6", "#6366f1", "#f59e0b"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [`$${value.toLocaleString()}`, undefined]}
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none" }}
                        labelStyle={{ color: "#fff", fontWeight: "bold" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Custom Legend */}
                <div className="flex-1 flex flex-col gap-2 w-full">
                  {workerStats.paymentMethodData.map((entry, index) => {
                    const colors = ["#10b981", "#3b82f6", "#6366f1", "#f59e0b"];
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-[11px] border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                          <span className="text-slate-600 font-semibold">{entry.name}</span>
                        </div>
                        <span className="text-slate-900 font-black">{formatCOP(entry.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK COMMAND ACTION CARDS */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
          Atajos Rápidos de Terminal
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to={ROUTES.WORKSPACE}
            className="bg-white border border-slate-100 hover:border-indigo-200 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-3 shadow-xs transition-all group"
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">Nueva Venta</span>
          </Link>

          <Link
            to={ROUTES.CLIENTS}
            className="bg-white border border-slate-100 hover:border-indigo-200 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-3 shadow-xs transition-all group"
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">Clientes Cartera</span>
          </Link>

          <Link
            to={ROUTES.EXPENSES}
            className="bg-white border border-slate-100 hover:border-rose-200 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-3 shadow-xs transition-all group"
          >
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">Cargar Egreso</span>
          </Link>

          <Link
            to={ROUTES.CASH_REGISTER}
            className="bg-white border border-slate-100 hover:border-amber-200 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-3 shadow-xs transition-all group"
          >
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">Cierre de Caja</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboardPage;
