import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { getInvoices } from "../../../services/invoice.service";
import {
  getProducts,
  getCategories,
  saveProducts,
  saveCategories,
  upsertProduct,
  deleteProduct,
  Product,
  Category
} from "../../../services/product.service";
import { formatCOP } from "../../../utils/colombia";
import { exportInventoryCSV, exportInventoryPDF } from "../../../utils/exportReports";
import {
  Package,
  Plus,
  Search,
  Tag,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FolderPlus,
  Info,
  BadgeAlert,
  Percent,
  Receipt,
  X,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  History
} from "lucide-react";

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Core list states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // AI Suggestions states
  interface AISuggestion {
    productId: string;
    productName: string;
    currentStock: number;
    minStock: number;
    suggestedReorder: number;
    priority: "alta" | "media" | "baja";
    reasoning: string;
    applied?: boolean;
  }

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [reorderAmounts, setReorderAmounts] = useState<Record<string, number>>({});

  const handleFetchSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setAiError(null);
    try {
      const allInvoices = getInvoices();
      const res = await fetch("/api/stock-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products: getProducts(),
          salesHistory: allInvoices,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al obtener sugerencias de la IA.");
      }

      const data = await res.json();
      setAiSuggestions(data);

      const initialAmounts: Record<string, number> = {};
      data.forEach((s: AISuggestion) => {
        initialAmounts[s.productId] = s.suggestedReorder;
      });
      setReorderAmounts(initialAmounts);
    } catch (err: any) {
      console.error("AI error:", err);
      setAiError(err.message || "Error al procesar la sugerencia con Inteligencia Artificial.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Filtering states
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterLowStock, setLowStockFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Recent Searches state & persistence
  interface RecentSearch {
    id: string;
    type: "text" | "category" | "product";
    query: string;
    label: string;
    timestamp: number;
  }

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      const stored = localStorage.getItem("softwork_recent_inventory_searches");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addRecentSearch = (type: "text" | "category" | "product", query: string, label: string) => {
    if (!query || !query.trim() || query.trim().length < 2) return;
    const cleanedQuery = query.trim();
    const cleanedLabel = label.trim();

    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (item) => !(item.type === type && item.query.toLowerCase() === cleanedQuery.toLowerCase())
      );
      const newItem: RecentSearch = {
        id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        query: cleanedQuery,
        label: cleanedLabel,
        timestamp: Date.now(),
      };
      const updated = [newItem, ...filtered].slice(0, 8); // Keep up to 8 recent searches
      localStorage.setItem("softwork_recent_inventory_searches", JSON.stringify(updated));
      return updated;
    });
  };

  // Debounced search save
  useEffect(() => {
    if (!search || search.trim().length < 2) return;
    const handler = setTimeout(() => {
      addRecentSearch("text", search, search);
    }, 1500); // Save search term after 1.5s of no typing

    return () => clearTimeout(handler);
  }, [search]);

  // Modal states
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  // Form states for Product
  const [prodForm, setProdForm] = useState({
    id: "",
    barcode: "",
    name: "",
    category: "",
    purchasePrice: 0,
    salePrice: 0,
    taxRate: 19,
    stock: 0,
    minStock: 5,
    active: true,
    description: "",
  });

  // Form states for Category
  const [catForm, setCatForm] = useState({
    id: "",
    name: "",
    description: "",
  });

  // Load datasets
  const loadData = () => {
    setProducts(getProducts());
    setCategories(getCategories());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Text Search
      const matchesText =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.includes(search) ||
        p.description.toLowerCase().includes(search.toLowerCase());

      // 2. Category
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;

      // 3. Low stock state
      const matchesLowStock = !filterLowStock || p.stock <= p.minStock;

      // 4. Active/Inactive Status
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.active) ||
        (statusFilter === "inactive" && !p.active);

      return matchesText && matchesCategory && matchesLowStock && matchesStatus;
    });
  }, [products, search, selectedCategory, filterLowStock, statusFilter]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, filterLowStock, statusFilter]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  }, [filteredProducts, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const validPage = Math.min(currentPage, totalPages);
    const start = (validPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage, totalPages]);

  // Notifications states
  const [showNotifications, setShowNotifications] = useState(true);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= p.minStock);
  }, [products]);

  const quickReorderStock = (product: Product, quantityToAdd: number) => {
    const updatedStock = product.stock + quantityToAdd;
    upsertProduct({
      ...product,
      stock: updatedStock,
      purchasePrice: Number(product.purchasePrice),
      salePrice: Number(product.salePrice),
      taxRate: Number(product.taxRate),
      minStock: Number(product.minStock),
    });
    showToast(`Reabastecimiento rápido exitoso. Se añadieron ${quantityToAdd} unidades a "${product.name}".`, "success");
    loadData();
  };

  // Open product modal
  const openProdModal = (product: Product | null = null) => {
    if (product) {
      setActiveProduct(product);
      setProdForm({ ...product });
      addRecentSearch("product", product.name, product.name);
    } else {
      setActiveProduct(null);
      setProdForm({
        id: "",
        barcode: "",
        name: "",
        category: categories[0]?.id || "",
        purchasePrice: 0,
        salePrice: 0,
        taxRate: 19,
        stock: 0,
        minStock: 5,
        active: true,
        description: "",
      });
    }
    setProdModalOpen(true);
  };

  // Handle product save
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim()) {
      showToast("Por favor escriba el nombre del producto.", "warning");
      return;
    }
    if (!prodForm.barcode.trim()) {
      showToast("Por favor ingrese o escanee un código de barras.", "warning");
      return;
    }

    const updated = upsertProduct({
      ...prodForm,
      purchasePrice: Number(prodForm.purchasePrice),
      salePrice: Number(prodForm.salePrice),
      taxRate: Number(prodForm.taxRate),
      stock: Number(prodForm.stock),
      minStock: Number(prodForm.minStock),
    });

    showToast(
      `Producto "${updated.name}" ${activeProduct ? "actualizado" : "creado"} correctamente.`,
      "success"
    );
    setProdModalOpen(false);
    loadData();
  };

  // Handle product delete
  const handleDeleteProduct = (product: Product) => {
    showConfirm({
      title: "Eliminar Producto",
      message: `¿Está seguro de que desea eliminar permanentemente "${product.name}" del catálogo comercial?`,
      confirmText: "Eliminar",
      severity: "danger",
      onConfirm: () => {
        deleteProduct(product.id);
        showToast("Producto eliminado correctamente del catálogo.", "success");
        loadData();
      },
    });
  };

  // Export current data view to CSV
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
        "Código de Barras",
        "Nombre",
        "Categoría",
        "Descripción",
        "Precio Compra (COP)",
        "Precio Venta (COP)",
        "IVA (%)",
        "Existencias",
        "Stock Mínimo",
        "Valor Costo Total (COP)",
        "Valor Venta Total (COP)",
        "Valor Venta con IVA (COP)",
        "Ganancia Potencial Estimada (COP)",
        "Estado"
      ];

      const rows = filteredProducts.map((p) => {
        const purchaseVal = (p.purchasePrice || 0) * (p.stock || 0);
        const saleVal = (p.salePrice || 0) * (p.stock || 0);
        const saleWithTaxVal = (p.salePrice || 0) * (1 + (p.taxRate || 0) / 100) * (p.stock || 0);
        const potentialProfit = saleVal - purchaseVal;

        return [
          p.barcode,
          p.name,
          p.category,
          p.description || "",
          p.purchasePrice,
          p.salePrice,
          p.taxRate,
          p.stock,
          p.minStock,
          purchaseVal,
          saleVal,
          Math.round(saleWithTaxVal),
          potentialProfit,
          p.active ? "Activo" : "Inactivo"
        ];
      });

      // Calculate totals for summary row
      let totalStock = 0;
      let totalPurchaseVal = 0;
      let totalSaleVal = 0;
      let totalSaleWithTaxVal = 0;
      let totalProfit = 0;

      filteredProducts.forEach((p) => {
        const qty = p.stock || 0;
        totalStock += qty;
        totalPurchaseVal += (p.purchasePrice || 0) * qty;
        totalSaleVal += (p.salePrice || 0) * qty;
        totalSaleWithTaxVal += (p.salePrice || 0) * (1 + (p.taxRate || 0) / 100) * qty;
        totalProfit += ((p.salePrice || 0) - (p.purchasePrice || 0)) * qty;
      });

      const summaryRow = [
        "TOTALES",
        `Reporte generado el ${new Date().toLocaleDateString()}`,
        "",
        "",
        "",
        "",
        "",
        totalStock,
        "",
        totalPurchaseVal,
        totalSaleVal,
        Math.round(totalSaleWithTaxVal),
        totalProfit,
        ""
      ];

      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
        summaryRow.map(escapeCSV).join(",")
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `reporte_inventario_valorizado_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Reporte de inventario valorizado exportado correctamente.", "success");
    } catch (error) {
      showToast("Error al exportar los datos a CSV.", "error");
    }
  };

  // Open category modal
  const openCatModal = (category: Category | null = null) => {
    if (category) {
      setActiveCategory(category);
      setCatForm({ ...category });
    } else {
      setActiveCategory(null);
      setCatForm({ id: "", name: "", description: "" });
    }
    setCatOpen(true);
  };

  // Handle category save
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) {
      showToast("Por favor ingrese el nombre de la categoría.", "warning");
      return;
    }

    const currentCats = getCategories();
    if (activeCategory) {
      const idx = currentCats.findIndex((c) => c.id === activeCategory.id);
      if (idx >= 0) currentCats[idx] = { ...catForm };
    } else {
      catForm.id = `cat-${Date.now()}`;
      currentCats.push({ ...catForm });
    }
    saveCategories(currentCats);

    showToast(`Categoría "${catForm.name}" guardada correctamente.`, "success");
    setCatModalOpen(false);
    loadData();
  };

  // Set category modal toggle
  const setCatOpen = (open: boolean) => {
    setCatModalOpen(open);
  };

  // Calculate profit margin percentage inside product form
  const profitMarginPercent = useMemo(() => {
    const buy = prodForm.purchasePrice || 0;
    const sell = prodForm.salePrice || 0;
    if (buy <= 0) return 0;
    // Markup margin percent = ((Sell - Buy) / Buy) * 100
    const margin = ((sell - buy) / buy) * 100;
    return isNaN(margin) ? 0 : Math.round(margin);
  }, [prodForm.purchasePrice, prodForm.salePrice]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header and top commands */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            <Package className="w-5.5 h-5.5 text-indigo-600" /> Catálogo Comercial de Productos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestione productos, niveles de existencias, precios de compra/venta y alertas de reabastecimiento.
          </p>
        </div>

        {/* Top Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {user?.role === "ADMIN" && (
            <>
              <button
                type="button"
                onClick={() => {
                  exportInventoryCSV(filteredProducts, categories);
                  showToast("Reporte de inventario en CSV exportado para contabilidad.", "success");
                }}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/50 dark:border-emerald-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Exportar inventario valorizado a CSV contable"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Exportar CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  exportInventoryPDF(filteredProducts, categories);
                  showToast("Reporte contable de inventario en PDF generado con éxito.", "success");
                }}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/50 dark:border-rose-800/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Exportar reporte de inventario valorizado a PDF contable"
              >
                <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Exportar PDF
              </button>
            </>
          )}



          <button
            onClick={() => openCatModal(null)}
            className="px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-transparent dark:border-indigo-800/40 rounded-xl transition-all flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" /> Crear Categoría
          </button>
          
          <button
            onClick={() => openProdModal(null)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 dark:shadow-none flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Registrar Producto
          </button>
        </div>
      </div>

      {/* NOTIFICATION SYSTEM: LOW STOCK ALERTS */}
      {lowStockProducts.length > 0 && showNotifications && (
        <div id="reorder-alerts-panel" className="bg-gradient-to-r from-amber-50/90 to-orange-50/75 border border-amber-200 rounded-2xl p-5 shadow-xs transition-all animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                  Alertas de Reorden de Inventario 
                  <span className="bg-amber-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {lowStockProducts.length} {lowStockProducts.length === 1 ? "Producto crítico" : "Productos críticos"}
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Los siguientes artículos han caído por debajo de su stock de seguridad establecido. Ajuste su inventario o realice un reabastecimiento rápido para evitar desabastecimiento.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNotifications(false)}
              className="p-1 hover:bg-amber-200/50 rounded-lg text-amber-800 transition-colors cursor-pointer shrink-0"
              title="Ocultar alertas temporalmente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Low Stock Items Horizontal Scrolling List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mt-4">
            {lowStockProducts.map((p) => {
              const isExhausted = p.stock <= 0;
              const percent = Math.min(100, Math.round((p.stock / p.minStock) * 100)) || 0;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-amber-100 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs hover:border-amber-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 font-bold truncate max-w-[100px]">{p.barcode}</span>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          isExhausted
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isExhausted ? "AGOTADO" : `STOCK BAJO`}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mt-1.5 line-clamp-1" title={p.name}>
                      {p.name}
                    </h4>
                    
                    {/* Visual progress bar */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold mb-1">
                        <span>Existencias: {p.stock} u.</span>
                        <span>Mínimo: {p.minStock} u.</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isExhausted ? "bg-rose-500" : "bg-amber-500"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 pt-1 border-t border-slate-50">
                    <button
                      onClick={() => openProdModal(p)}
                      className="flex-1 py-1 px-2 border border-slate-200 hover:bg-slate-50 text-[10px] font-bold rounded-lg text-slate-600 transition-colors"
                    >
                      Ajustar Detalle
                    </button>
                    <button
                      onClick={() => quickReorderStock(p, 10)}
                      className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold rounded-lg text-white transition-colors"
                      title="Sumar 10 unidades inmediatamente"
                    >
                      Reabastecer +10
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Button to recover low stock notifications if hidden */}
      {!showNotifications && lowStockProducts.length > 0 && (
        <div id="reorder-alerts-summary" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
            <span>Hay <strong>{lowStockProducts.length}</strong> artículos con stock por debajo del límite mínimo.</span>
          </div>
          <button
            onClick={() => setShowNotifications(true)}
            className="text-[11px] font-extrabold text-indigo-700 hover:underline cursor-pointer"
          >
            Ver Alertas de Reorden
          </button>
        </div>
      )}

      {/* FILTER BAR CARDS */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar por nombre, código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search && search.trim()) {
                    addRecentSearch("text", search, search);
                  }
                }}
                className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors bg-white"
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

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val || "all");
                if (val && val !== "all") {
                  const catName = categories.find((c) => c.id === val)?.name || val;
                  addRecentSearch("category", val, `Categoría: ${catName}`);
                }
              }}
              className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white text-slate-700 font-medium"
            >
              <option value="all">Todas las Categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

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
                Pausados
              </button>
            </div>

            {/* Low Stock Switch Button / Badge */}
            <button
              onClick={() => setLowStockFilter(prev => !prev)}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                filterLowStock
                  ? "bg-amber-50 border-amber-200 text-amber-700 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <BadgeAlert className={`w-4 h-4 ${filterLowStock ? "text-amber-500 animate-pulse" : "text-slate-400"}`} />
              <span>Stock Crítico / Bajo</span>
              {lowStockProducts.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${filterLowStock ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                  {lowStockProducts.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Stats or clear filters button */}
          <div className="flex items-center gap-3 text-xs justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <span className="text-slate-500 font-bold">
              Artículos: <strong className="text-indigo-600 font-extrabold">{filteredProducts.length}</strong>
            </span>
            {(search || selectedCategory !== "all" || filterLowStock || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("all");
                  setLowStockFilter(false);
                  setStatusFilter("all");
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold rounded-lg transition-all flex items-center gap-1"
                title="Limpiar todos los filtros"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        {recentSearches.length > 0 && (
          <div className="border-t border-slate-100 pt-3.5 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <History className="w-3.5 h-3.5 text-indigo-500" /> Búsquedas Recientes:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {recentSearches.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.type === "category") {
                      setSelectedCategory(item.query);
                    } else {
                      setSearch(item.query);
                      setSelectedCategory("all"); // Reset category to all so it is visible
                    }
                  }}
                  className="px-2.5 py-1 text-[10.5px] font-semibold bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-slate-600 hover:text-indigo-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  {item.type === "category" ? (
                    <Tag className="w-2.5 h-2.5 text-indigo-400" />
                  ) : item.type === "product" ? (
                    <Package className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Search className="w-2.5 h-2.5 text-slate-400" />
                  )}
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem("softwork_recent_inventory_searches");
                }}
                className="px-2 py-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PRODUCT LIST GRID */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                <th className="py-3.5 px-6">Código de Barras</th>
                <th className="py-3.5 px-6">Detalle Producto</th>
                <th className="py-3.5 px-6">Categoría</th>
                <th className="py-3.5 px-6 text-right">Precio Costo</th>
                <th className="py-3.5 px-6 text-right">Precio Venta (COP)</th>
                <th className="py-3.5 px-6 text-center">Impuesto</th>
                <th className="py-3.5 px-6 text-center">Existencias</th>
                <th className="py-3.5 px-6 text-center">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-medium bg-slate-50/20">
                    No se encontraron productos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const categoryName = categories.find((c) => c.id === p.category)?.name || "N/A";
                  const isExhausted = p.stock <= 0;
                  const isCritical = p.stock <= p.minStock;

                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-50 transition-colors ${
                        isExhausted
                          ? "bg-rose-50/25 hover:bg-rose-50/45 border-l-4 border-l-rose-500"
                          : isCritical
                          ? "bg-amber-50/25 hover:bg-amber-50/45 border-l-4 border-l-amber-500"
                          : "hover:bg-slate-50/30"
                      }`}
                    >
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 tracking-tight">
                        <button
                          onClick={() => {
                            setSearch(p.barcode);
                            setSelectedCategory("all");
                            addRecentSearch("product", p.barcode, p.name);
                            showToast(`Filtrado por código: ${p.barcode}`, "info");
                          }}
                          className="hover:text-indigo-600 transition-colors text-left font-bold cursor-pointer"
                          title="Click para buscar este código de barras"
                        >
                          {p.barcode}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => {
                            setSearch(p.name);
                            setSelectedCategory("all");
                            addRecentSearch("product", p.name, p.name);
                            showToast(`Filtrado por producto: ${p.name}`, "info");
                          }}
                          className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors text-left leading-tight block w-full cursor-pointer"
                          title="Click para buscar este producto"
                        >
                          {p.name}
                        </button>
                        <span className="text-[10px] text-slate-400 mt-1 block max-w-xs truncate">
                          {p.description || "Sin descripción disponible."}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {categoryName}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-500">
                        {formatCOP(p.purchasePrice)}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900">
                        {formatCOP(p.salePrice)}
                      </td>
                      <td className="py-4 px-6 text-center text-slate-400 font-bold">
                        {p.taxRate}%
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isExhausted
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : isCritical
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }`}
                          >
                            {isExhausted ? "Agotado" : isCritical ? "Stock Bajo" : "Seguro"}: {p.stock} u.
                          </span>
                          <span className="text-[9px] text-slate-400 mt-1">Min: {p.minStock} u.</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            p.active ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.active ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                          {p.active ? "Activo" : "Pausado"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openProdModal(p)}
                            className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-slate-400 transition-all"
                            title="Editar Producto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-all"
                            title="Eliminar de Catálogo"
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
        {filteredProducts.length > 0 && (
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
              <span>productos por página</span>
              <span className="mx-2 text-slate-300">|</span>
              <span>
                Mostrando <strong className="font-semibold text-slate-800">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)}</strong> al <strong className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> de <strong className="font-semibold text-slate-800">{filteredProducts.length}</strong> productos
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

      {/* PRODUCT CREATION/EDITION MODAL */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                {activeProduct ? "Modificar Ficha de Producto" : "Nuevo Registro de Producto"}
              </h3>
              <button onClick={() => setProdModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Barcode */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Código de Barras *</label>
                  <input
                    type="text"
                    required
                    value={prodForm.barcode}
                    onChange={(e) => setProdForm({ ...prodForm, barcode: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="Escanear o digitar"
                  />
                </div>

                {/* Category selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Categoría</label>
                  <select
                    value={prodForm.category}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nombre Comercial del Producto *</label>
                  <input
                    type="text"
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej. Detergente Liquido Ariel 1L"
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Costo de Compra (COP) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={prodForm.purchasePrice || ""}
                    onChange={(e) => setProdForm({ ...prodForm, purchasePrice: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Sale Price */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Precio de Venta (COP) * 
                    {profitMarginPercent > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold ml-1">
                        (+{profitMarginPercent}% margen)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={prodForm.salePrice || ""}
                    onChange={(e) => setProdForm({ ...prodForm, salePrice: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Tax rate */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">IVA Aplicable (%)</label>
                  <select
                    value={prodForm.taxRate}
                    onChange={(e) => setProdForm({ ...prodForm, taxRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value={0}>Exento (0%)</option>
                    <option value={5}>Canasta Reducida (5%)</option>
                    <option value={19}>General IVA (19%)</option>
                  </select>
                </div>

                {/* Active status */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Estado de Venta</label>
                  <select
                    value={prodForm.active ? "true" : "false"}
                    onChange={(e) => setProdForm({ ...prodForm, active: e.target.value === "true" })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="true">Disponible para caja</option>
                    <option value="false">Oculto / Desactivado</option>
                  </select>
                </div>

                {/* Stock */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Existencias Iniciales</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: Math.max(0, Number(e.target.value)) })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Min stock warning */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={prodForm.minStock}
                    onChange={(e) => setProdForm({ ...prodForm, minStock: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Descripción Breve</label>
                  <textarea
                    rows={2}
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Detalles sobre presentación, empaque..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Guardar Ficha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY CREATION MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-600" /> Crear Nueva Categoría
              </h3>
              <button onClick={() => setCatModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre de la Categoría *</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ej. Higiene Personal"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ej. Desodorantes, cremas dentales y jabones..."
                />
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI STOCK SUGGESTIONS MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-zoom-in max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-xl">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    Sugerencias de Stock Inteligente
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Gemini IA
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Análisis de velocidad de venta y umbrales mínimos
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAiModalOpen(false)} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Area */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {isLoadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-purple-500/20 dark:bg-purple-500/10 blur-xl animate-pulse w-16 h-16" />
                    <div className="relative w-16 h-16 rounded-full border-4 border-purple-100 dark:border-purple-950 border-t-purple-600 dark:border-t-purple-400 animate-spin flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-pulse" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 animate-pulse">
                    Analizando inventario e historial de ventas...
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
                    Estamos cruzando los niveles de stock actuales, stock mínimos de alerta y el historial de transacciones para recomendar reordenes ideales en Colombia.
                  </p>
                </div>
              ) : aiError ? (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400">Hubo un problema al consultar la IA</h4>
                    <p className="text-xs text-rose-600 dark:text-rose-500 mt-1">{aiError}</p>
                    <button
                      onClick={handleFetchSuggestions}
                      className="mt-3 px-3 py-1.5 text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reintentar Consulta
                    </button>
                  </div>
                </div>
              ) : aiSuggestions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">¡Niveles de Inventario Optimizados!</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                    La Inteligencia Artificial analizó los datos y determinó que ningún producto se encuentra en estado crítico o requiere de reabastecimiento urgente de acuerdo con la rotación de ventas.
                  </p>
                  <button
                    onClick={handleFetchSuggestions}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl hover:bg-indigo-100 transition-all inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Volver a Analizar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100/50 dark:border-purple-900/20 rounded-2xl">
                    <p className="text-[11px] text-purple-800 dark:text-purple-300 font-medium leading-relaxed">
                      💡 <strong>Análisis Estratégico de Cadena:</strong> A continuación se muestran los artículos que presentan alertas por stock inferior al límite, respaldados por un análisis de demanda histórico. Puedes ajustar la cantidad recomendada antes de aplicarla directamente al inventario.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {aiSuggestions.map((s) => {
                      const matchingProduct = products.find(p => p.id === s.productId);
                      const priorityColor = 
                        s.priority === "alta" 
                          ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
                          : s.priority === "media"
                            ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                            : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";

                      return (
                        <div 
                          key={s.productId} 
                          className={`p-4 rounded-2xl border transition-all ${
                            s.applied 
                              ? "bg-emerald-50/10 dark:bg-emerald-950/5 border-emerald-100 dark:border-emerald-900/30" 
                              : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800"
                          }`}
                        >
                          {/* Item Title Line */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {s.productName}
                                {matchingProduct && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    ({matchingProduct.category})
                                  </span>
                                )}
                              </h4>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Existencias: <strong className="text-slate-700 dark:text-slate-200">{s.currentStock}</strong> / Stock Mín: {s.minStock}
                                </span>
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${priorityColor}`}>
                                  Prioridad {s.priority}
                                </span>
                              </div>
                            </div>

                            {/* Control Actions */}
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => setReorderAmounts(prev => ({
                                    ...prev,
                                    [s.productId]: Math.max(1, (prev[s.productId] ?? s.suggestedReorder) - 1)
                                  }))}
                                  disabled={s.applied}
                                  className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                                >
                                  -
                                </button>
                                <input
                                  type="text"
                                  pattern="[0-9]*"
                                  value={reorderAmounts[s.productId] ?? s.suggestedReorder}
                                  disabled={s.applied}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setReorderAmounts(prev => ({ ...prev, [s.productId]: val }));
                                  }}
                                  className="w-10 text-center text-xs font-extrabold bg-transparent text-slate-800 dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setReorderAmounts(prev => ({
                                    ...prev,
                                    [s.productId]: (prev[s.productId] ?? s.suggestedReorder) + 1
                                  }))}
                                  disabled={s.applied}
                                  className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const realProd = products.find(p => p.id === s.productId);
                                  if (realProd) {
                                    const amt = reorderAmounts[s.productId] ?? s.suggestedReorder;
                                    quickReorderStock(realProd, amt);
                                    setAiSuggestions(prev => prev.map(item => item.productId === s.productId ? { ...item, applied: true } : item));
                                  } else {
                                    showToast("No se encontró el registro real de este producto.", "error");
                                  }
                                }}
                                disabled={s.applied}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                  s.applied
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold"
                                }`}
                              >
                                {s.applied ? (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5" /> Aplicado
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> Reabastecer
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* AI Rationale block */}
                          <div className="mt-3 p-2.5 rounded-xl bg-purple-50/20 dark:bg-purple-950/5 border border-purple-100/20 dark:border-purple-900/10">
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                              &ldquo;{s.reasoning}&rdquo;
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/20">
              <button
                type="button"
                onClick={handleFetchSuggestions}
                disabled={isLoadingSuggestions}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSuggestions ? 'animate-spin' : ''}`} /> Volver a Analizar
              </button>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 rounded-xl transition-all"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
