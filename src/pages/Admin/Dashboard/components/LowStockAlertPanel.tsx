import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { getProducts, bulkAdjustStock, Product } from "../../../../services/product.service";
import { useUiFeedback } from "../../../../context/UiFeedbackContext";
import { ROUTES } from "../../../../shared/constants";
import { formatCOP } from "../../../../utils/colombia";
import {
  AlertTriangle,
  Info,
  Sliders,
  ArrowUpRight,
  CheckCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  X,
  TrendingUp,
  Boxes,
  Zap
} from "lucide-react";

export const LowStockAlertPanel: React.FC = () => {
  const { showToast } = useUiFeedback();

  // State management
  const [products, setProducts] = useState<Product[]>([]);
  const [thresholdMode, setThresholdMode] = useState<"product-specific" | "custom">("product-specific");
  const [customThreshold, setCustomThreshold] = useState<number>(10);
  const [statusTab, setStatusTab] = useState<"ALL" | "OUT" | "CRITICAL">("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Restock Modal State
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);

  // Load products dynamically
  const reloadProducts = () => {
    try {
      setProducts(getProducts() || []);
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    reloadProducts();
  }, []);

  // Filter products by threshold & search
  const lowStockItems = useMemo(() => {
    return products.filter((p) => {
      if (!p || !p.active) return false;

      // Match search query
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = (p.name || "").toLowerCase().includes(query);
        const matchesBarcode = (p.barcode || "").includes(query);
        if (!matchesName && !matchesBarcode) return false;
      }

      // Check threshold condition
      let isLow = false;
      if (thresholdMode === "product-specific") {
        isLow = (p.stock || 0) <= (p.minStock || 0);
      } else {
        isLow = (p.stock || 0) <= customThreshold;
      }

      if (!isLow) return false;

      // Status sub-tab filtering
      if (statusTab === "OUT") return p.stock === 0;
      if (statusTab === "CRITICAL") return p.stock > 0;

      return true;
    });
  }, [products, thresholdMode, customThreshold, statusTab, searchTerm]);

  // Sort items: Out of stock first, then ascending stock
  const sortedItems = useMemo(() => {
    return [...lowStockItems].sort((a, b) => {
      if (a.stock === 0 && b.stock > 0) return -1;
      if (b.stock === 0 && a.stock > 0) return 1;
      return (a.stock || 0) - (b.stock || 0);
    });
  }, [lowStockItems]);

  // Global system counters
  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p && p.active && p.stock === 0).length;
  }, [products]);

  const criticalCount = useMemo(() => {
    return products.filter((p) => p && p.active && p.stock > 0 && p.stock <= (p.minStock || 0)).length;
  }, [products]);

  const systemLowStockCount = outOfStockCount + criticalCount;

  // Total investment required to replenish all low stock items up to minStock + 10
  const estimatedInvestmentRequired = useMemo(() => {
    return products.reduce((acc, p) => {
      if (!p || !p.active) return acc;
      const targetStock = Math.max(p.minStock || 10, 10);
      if (p.stock < targetStock) {
        const needed = targetStock - p.stock;
        return acc + needed * (p.purchasePrice || 0);
      }
      return acc;
    }, 0);
  }, [products]);

  // Quick Restock Handler
  const handleConfirmRestock = () => {
    if (!restockProduct) return;
    if (restockQty <= 0) {
      showToast("La cantidad a surtir debe ser mayor a 0", "error");
      return;
    }

    try {
      bulkAdjustStock([{ id: restockProduct.id, qty: restockQty }]);
      showToast(`¡Surtido exitoso! Se añadieron +${restockQty} unidades a "${restockProduct.name}"`, "success");
      reloadProducts();
      setRestockProduct(null);
      setRestockQty(10);
    } catch {
      showToast("Error al actualizar el stock del producto", "error");
    }
  };

  return (
    <div id="low-stock-alert-panel" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-xs p-5 flex flex-col gap-4 h-full transition-colors duration-150">
      {/* Header with Title, Refresher, and Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${systemLowStockCount > 0 ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"}`}>
              <AlertTriangle className={`w-4 h-4 ${systemLowStockCount > 0 ? "animate-pulse" : ""}`} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Alertas de Stock Bajo
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Monitoreo proactivo de productos bajo el umbral crítico.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reloadProducts}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Actualizar datos de inventario"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              systemLowStockCount > 0
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50"
            }`}
          >
            {systemLowStockCount > 0 ? `${systemLowStockCount} Alertas` : "Catálogo OK"}
          </span>
        </div>
      </div>

      {/* Threshold & Filter Controls Box */}
      <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex flex-col gap-3">
        {/* Threshold mode selector */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sliders className="w-3 h-3 text-indigo-500" /> Umbral de Alerta
          </label>
          <div className="flex items-center bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setThresholdMode("product-specific")}
              className={`px-2 py-1 text-[9.5px] font-extrabold rounded-md transition-all cursor-pointer ${
                thresholdMode === "product-specific"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Mín. Producto
            </button>
            <button
              type="button"
              onClick={() => setThresholdMode("custom")}
              className={`px-2 py-1 text-[9.5px] font-extrabold rounded-md transition-all cursor-pointer ${
                thresholdMode === "custom"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Fijo Personalizado
            </button>
          </div>
        </div>

        {/* Custom threshold slider and quick presets */}
        {thresholdMode === "custom" && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 animate-fade-in">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              <span>Umbral Personalizado:</span>
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                &lt;= {customThreshold} unidades
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400 font-bold mr-1">Rápido:</span>
              {[3, 5, 10, 20, 50].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCustomThreshold(val)}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-md border cursor-pointer transition-all ${
                    customThreshold === val
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {val}u
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="range"
                min="1"
                max="100"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(parseInt(e.target.value) || 10)}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-[10px] font-bold text-slate-400 shrink-0">100u</span>
            </div>
          </div>
        )}

        {/* Urgency Filter Tabs & Search Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-1 bg-slate-200/50 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200/40 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStatusTab("ALL")}
              className={`flex-1 py-1 text-[9.5px] font-extrabold rounded-md text-center transition-all cursor-pointer ${
                statusTab === "ALL"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Todos ({systemLowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("OUT")}
              className={`flex-1 py-1 text-[9.5px] font-extrabold rounded-md text-center transition-all cursor-pointer ${
                statusTab === "OUT"
                  ? "bg-rose-500 text-white shadow-2xs"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              }`}
            >
              Agotados ({outOfStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("CRITICAL")}
              className={`flex-1 py-1 text-[9.5px] font-extrabold rounded-md text-center transition-all cursor-pointer ${
                statusTab === "CRITICAL"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              }`}
            >
              Stock Bajo ({criticalCount})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar en productos en alerta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-[10.5px] font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-lg pl-8 pr-2.5 py-1.5 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 flex flex-col gap-2">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500 gap-2 h-full text-center">
            <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Sin productos bajo este criterio
            </p>
            <p className="text-[10px] max-w-[220px] font-normal leading-relaxed">
              Todos los productos activos del inventario cumplen con las condiciones de stock seleccionadas.
            </p>
          </div>
        ) : (
          sortedItems.map((prod) => {
            const isOut = prod.stock === 0;
            const minQty = prod.minStock || 5;
            const stockPct = Math.min(100, Math.round(((prod.stock || 0) / Math.max(1, minQty)) * 100));

            // Visual badges
            let badgeText = `Bajo (${prod.stock})`;
            let badgeClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
            let barColor = "bg-amber-500";

            if (isOut) {
              badgeText = "Agotado (0)";
              badgeClass = "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 animate-pulse";
              barColor = "bg-rose-500";
            }

            return (
              <div
                key={prod.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-800/30 hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-all gap-2"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={prod.name}>
                      {prod.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[9.5px] text-slate-400 dark:text-slate-400 font-mono mt-0.5">
                    <span>SKU: {prod.barcode || "N/A"}</span>
                    <span>•</span>
                    <span>Mín: {minQty}u.</span>
                    <span>•</span>
                    <span className="text-slate-600 dark:text-slate-300 font-sans font-bold">
                      Costo: {formatCOP(prod.purchasePrice || 0)}
                    </span>
                  </div>

                  {/* Stock progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all duration-300`}
                      style={{ width: `${isOut ? 0 : Math.max(5, stockPct)}%` }}
                    />
                  </div>
                </div>

                {/* Badge and Proactive Restock Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold border ${badgeClass}`}>
                    {badgeText}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setRestockProduct(prod);
                      setRestockQty(10);
                    }}
                    className="px-2 py-1 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200/60 dark:border-indigo-800/50 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Surtir o reabastecer stock rápidamente"
                  >
                    <Plus className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Surtir
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Financial Summary & Inventory Direct Link */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>
            Inversión Est. para Surtir:{" "}
            <strong className="text-slate-800 dark:text-slate-200 font-black">
              {formatCOP(estimatedInvestmentRequired)}
            </strong>
          </span>
        </div>

        <Link
          to={ROUTES.INVENTORY}
          className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-all"
        >
          Gestionar Catálogo <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* QUICK RESTOCK MODAL */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    Reabastecimiento Rápido de Stock
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Añada inventario a este producto en tiempo real
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRestockProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Details Card */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {restockProduct.name}
              </span>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Código / Barcode: <strong className="text-slate-700 dark:text-slate-300">{restockProduct.barcode || "N/A"}</strong></span>
                <span>Stock Actual: <strong className={restockProduct.stock === 0 ? "text-rose-600 dark:text-rose-400 font-extrabold" : "text-amber-600 dark:text-amber-400 font-extrabold"}>{restockProduct.stock} u.</strong></span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Costo de Compra: <strong className="text-slate-800 dark:text-slate-200">{formatCOP(restockProduct.purchasePrice || 0)}</strong>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Cantidad a Añadir (+ Unidades)
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5">
                {[5, 10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRestockQty(preset)}
                    className={`flex-1 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                      restockQty === preset
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full text-sm font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Total Cost Estimate Banner */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
              <span className="text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                Costo Total Estimado:
              </span>
              <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
                {formatCOP(restockQty * (restockProduct.purchasePrice || 0))}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRestockProduct(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestock}
                className="flex-1 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" /> Confirmar Surtido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

