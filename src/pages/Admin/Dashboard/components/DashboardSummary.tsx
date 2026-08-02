import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { getInvoices } from "../../../../services/invoice.service";
import { getProducts } from "../../../../services/product.service";
import { formatCOP } from "../../../../utils/colombia";
import { ROUTES } from "../../../../shared/constants";
import {
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  ArrowUpRight,
  Package,
  Activity,
  CheckCircle2
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis
} from "recharts";

export const DashboardSummary: React.FC = () => {
  // Fetch data
  const invoices = useMemo(() => {
    try {
      return getInvoices() || [];
    } catch {
      return [];
    }
  }, []);

  const products = useMemo(() => {
    try {
      return getProducts() || [];
    } catch {
      return [];
    }
  }, []);

  // Calculate Dates for past 7 days (including today)
  const last7DaysData = useMemo(() => {
    try {
      const dates: string[] = [];
      const daysOfWeek = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const chartDataList: {
        dateStr: string;
        label: string;
        revenue: number;
        orders: number;
      }[] = [];

      // Generate dates for past 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const label = daysOfWeek[d.getDay()];
        dates.push(dateStr);
        chartDataList.push({
          dateStr,
          label,
          revenue: 0,
          orders: 0
        });
      }

      // Map for easy lookup
      const lookup: { [key: string]: number } = {};
      chartDataList.forEach((item, index) => {
        lookup[item.dateStr] = index;
      });

      // Populate with invoice data
      invoices.forEach((inv) => {
        if (!inv || !inv.createdAt || inv.status === "REFUNDED") return;
        const dateStr = inv.createdAt.split("T")[0];
        if (lookup[dateStr] !== undefined) {
          const idx = lookup[dateStr];
          chartDataList[idx].revenue += inv.total || 0;
          chartDataList[idx].orders += 1;
        }
      });

      return chartDataList;
    } catch (e) {
      console.error("Error calculating last7DaysData:", e);
      return [];
    }
  }, [invoices]);

  // Specific day indices
  const todayRevenue = useMemo(() => {
    if (last7DaysData.length === 0) return 0;
    return last7DaysData[last7DaysData.length - 1].revenue;
  }, [last7DaysData]);

  const yesterdayRevenue = useMemo(() => {
    if (last7DaysData.length < 2) return 0;
    return last7DaysData[last7DaysData.length - 2].revenue;
  }, [last7DaysData]);

  const todayOrders = useMemo(() => {
    if (last7DaysData.length === 0) return 0;
    return last7DaysData[last7DaysData.length - 1].orders;
  }, [last7DaysData]);

  const yesterdayOrders = useMemo(() => {
    if (last7DaysData.length < 2) return 0;
    return last7DaysData[last7DaysData.length - 2].orders;
  }, [last7DaysData]);

  // Low stock products count and distribution
  const stockStats = useMemo(() => {
    try {
      const activeProducts = products.filter((p) => p && p.active);
      const lowStockList = activeProducts.filter((p) => (p.stock || 0) <= (p.minStock || 0));
      const criticalCount = lowStockList.length;
      const healthyCount = Math.max(0, activeProducts.length - criticalCount);

      // Top 3 critically low products
      const topCriticalProducts = [...lowStockList]
        .sort((a, b) => (a.stock || 0) - (b.stock || 0))
        .slice(0, 3)
        .map((p) => ({
          name: p.name || "Producto",
          stock: p.stock || 0,
          minStock: p.minStock || 0
        }));

      return {
        criticalCount,
        healthyCount,
        totalActive: activeProducts.length,
        topCriticalProducts,
        pieData: [
          { name: "Crítico", value: criticalCount, color: "#f59e0b" },
          { name: "Óptimo", value: healthyCount, color: "#10b981" }
        ]
      };
    } catch (e) {
      console.error("Error calculating stock stats:", e);
      return {
        criticalCount: 0,
        healthyCount: 0,
        totalActive: 0,
        topCriticalProducts: [],
        pieData: [
          { name: "Crítico", value: 0, color: "#f59e0b" },
          { name: "Óptimo", value: 0, color: "#10b981" }
        ]
      };
    }
  }, [products]);

  // Revenue percentage change
  const revenueChangePercent = useMemo(() => {
    if (yesterdayRevenue === 0) return todayRevenue > 0 ? 100 : 0;
    return Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100);
  }, [todayRevenue, yesterdayRevenue]);

  // Orders percentage change
  const ordersChangePercent = useMemo(() => {
    if (yesterdayOrders === 0) return todayOrders > 0 ? 100 : 0;
    return Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100);
  }, [todayOrders, yesterdayOrders]);

  return (
    <div id="dashboard-summary-widget" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-2">
      {/* 1. Daily Revenue Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-[180px] relative overflow-hidden group hover:border-indigo-200 transition-all">
        <div className="flex items-center justify-between z-10">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Ingresos de Hoy
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
              {formatCOP(todayRevenue)}
            </h3>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Recharts Area Mini Sparkline */}
        <div className="absolute inset-x-0 bottom-12 h-14 w-full px-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last7DaysData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value: any) => [`$${value.toLocaleString()}`, "Ingreso"]}
                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", padding: "4px 8px" }}
                labelStyle={{ display: "none" }}
                itemStyle={{ color: "#fff", fontSize: "10px", fontWeight: "bold" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-3 z-10">
          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
            Ayer: <strong className="text-slate-700">{formatCOP(yesterdayRevenue)}</strong>
          </span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              revenueChangePercent >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {revenueChangePercent >= 0 ? "+" : ""}
            {revenueChangePercent}%
          </span>
        </div>
      </div>

      {/* 2. Low-Stock Alerts Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-[180px] relative overflow-hidden group hover:border-amber-200 transition-all">
        <div className="flex items-center justify-between z-10">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Alertas de Stock
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
              {stockStats.criticalCount} Críticos
            </h3>
          </div>
          <div
            className={`p-2.5 rounded-xl ${
              stockStats.criticalCount > 0
                ? "bg-amber-50 text-amber-600 animate-pulse"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Content layout: Left stats, Right PieChart */}
        <div className="flex items-center justify-between h-14 z-10 my-1">
          {stockStats.criticalCount > 0 ? (
            <div className="flex flex-col gap-1 max-w-[55%]">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase">Más Críticos:</span>
              <div className="flex flex-col gap-0.5">
                {stockStats.topCriticalProducts.map((prod, i) => (
                  <span key={i} className="text-[10px] text-slate-700 font-bold truncate">
                    • {prod.name} ({prod.stock}/{prod.minStock} u.)
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-bold">Todo el catálogo tiene stock adecuado.</span>
            </div>
          )}

          {/* Donut Chart of Stock Health */}
          <div className="w-20 h-20 shrink-0 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockStats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={18}
                  outerRadius={26}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stockStats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-[8px] font-black text-slate-600 flex flex-col items-center">
              <span>{Math.round((stockStats.healthyCount / (stockStats.totalActive || 1)) * 100)}%</span>
              <span className="text-[6px] text-slate-400">OK</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-3 z-10">
          <span className="text-[10px] text-slate-500 font-bold">
            Total activos: <strong className="text-slate-700">{stockStats.totalActive} productos</strong>
          </span>
          <Link
            to={ROUTES.INVENTORY}
            className="text-[10px] font-black text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
          >
            Surtir <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 3. Active Orders (Today) Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-[180px] relative overflow-hidden group hover:border-emerald-200 transition-all">
        <div className="flex items-center justify-between z-10">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Ventas Realizadas Hoy
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
              {todayOrders} {todayOrders === 1 ? "Factura" : "Facturas"}
            </h3>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        {/* Recharts Bar Sparkline of Orders */}
        <div className="absolute inset-x-0 bottom-12 h-14 w-full px-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7DaysData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <Tooltip
                formatter={(value: any) => [`${value} Ventas`, "Cantidad"]}
                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", padding: "4px 8px" }}
                labelStyle={{ display: "none" }}
                itemStyle={{ color: "#fff", fontSize: "10px", fontWeight: "bold" }}
              />
              <Bar dataKey="orders" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-3 z-10">
          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
            Ayer: <strong className="text-slate-700">{yesterdayOrders} ventas</strong>
          </span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              ordersChangePercent >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {ordersChangePercent >= 0 ? "+" : ""}
            {ordersChangePercent}%
          </span>
        </div>
      </div>
    </div>
  );
};
