import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../utils/permissions";
import { PERMISSIONS } from "../../../permissions/PermissionConstants";
import {
  getSuppliers,
  upsertSupplier,
  deleteSupplier,
  getPurchases,
  recordPurchaseInvoice,
  Supplier,
  PurchaseInvoice
} from "../../../services/invoice.service";
import { getProducts, saveProducts } from "../../../services/product.service";
import { formatCOP, formatDateCO } from "../../../utils/colombia";
import {
  Truck,
  Plus,
  Search,
  Trash2,
  Edit2,
  UserPlus,
  Phone,
  Mail,
  Receipt,
  Package,
  Calendar,
  X,
  PlusCircle,
  FolderOpen,
  AlertCircle,
  AlertTriangle
} from "lucide-react";

export const SuppliersPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Sub-permissions
  const canCreateSupplier = hasPermission(user, PERMISSIONS.CREATE_SUPPLIER);
  const canEditSupplier = hasPermission(user, PERMISSIONS.EDIT_SUPPLIER);
  const canDeleteSupplier = hasPermission(user, PERMISSIONS.DELETE_SUPPLIER);
  const canRecordPurchase = hasPermission(user, PERMISSIONS.RECORD_PURCHASE_INVOICE);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"catalog" | "purchases">("catalog");
  const [search, setSearch] = useState("");

  // Supplier catalog modal & validation
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [supForm, setSupForm] = useState({
    id: "",
    name: "",
    nit: "",
    phone: "",
    email: "",
    address: "",
    active: true,
  });

  const [supFormErrors, setSupFormErrors] = useState<Record<string, string>>({});
  const [supTouchedFields, setSupTouchedFields] = useState<Record<string, boolean>>({});
  const [supSubmitAttempted, setSupSubmitAttempted] = useState(false);

  const validateSupplierForm = (formData = supForm) => {
    const errors: Record<string, string> = {};

    // 1. Name
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = "La razón social o nombre comercial es obligatorio.";
    } else if (trimmedName.length < 3) {
      errors.name = "La razón social debe tener al menos 3 caracteres.";
    } else if (/^\d+$/.test(trimmedName)) {
      errors.name = "El nombre no puede ser compuesto solo de números.";
    }

    // 2. NIT
    const trimmedNit = formData.nit.trim();
    if (!trimmedNit) {
      errors.nit = "El NIT comercial es obligatorio.";
    } else if (trimmedNit.length < 5) {
      errors.nit = "El NIT debe tener al menos 5 caracteres.";
    } else if (!/^[a-zA-Z0-9\s.-]+$/.test(trimmedNit)) {
      errors.nit = "El NIT solo puede incluir letras, números, puntos y guiones.";
    } else {
      const duplicate = suppliers.find(
        (s) => s.nit.toLowerCase() === trimmedNit.toLowerCase() && s.id !== activeSupplier?.id
      );
      if (duplicate) {
        errors.nit = `Ya existe un proveedor registrado con el NIT ${trimmedNit} (${duplicate.name}).`;
      }
    }

    // 3. Email
    const trimmedEmail = formData.email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Formato de correo no válido (ejemplo: pedidos@proveedor.com).";
    }

    // 4. Phone
    const trimmedPhone = formData.phone.trim();
    if (trimmedPhone) {
      const digitsOnly = trimmedPhone.replace(/\D/g, "");
      if (digitsOnly.length < 7) {
        errors.phone = "El número telefónico debe tener al menos 7 dígitos.";
      }
    }

    return errors;
  };

  // Purchase registering modal
  const [purModalOpen, setPurModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<{ productId: string; name: string; qty: number; cost: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");

  // Temporary purchase line item input helpers
  const [tempProduct, setTempProduct] = useState("");
  const [tempQty, setTempQty] = useState(1);
  const [tempCost, setTempCost] = useState(0);

  const loadData = () => {
    setSuppliers(getSuppliers());
    setPurchases(getPurchases());
    setProducts(getProducts());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter lists based on text search
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.nit.includes(q) || s.email.toLowerCase().includes(q);
    });
  }, [suppliers, search]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const q = search.toLowerCase();
      return p.supplierName.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [purchases, search]);

  const openSupModal = (supplier: Supplier | null = null) => {
    setSupFormErrors({});
    setSupTouchedFields({});
    setSupSubmitAttempted(false);

    if (supplier) {
      if (!canEditSupplier) {
        showToast("Permiso denegado: No tiene permisos para modificar datos de proveedores.", "warning");
        return;
      }
      setActiveSupplier(supplier);
      setSupForm({ ...supplier });
    } else {
      if (!canCreateSupplier) {
        showToast("Permiso denegado: No tiene permisos para registrar nuevos proveedores.", "warning");
        return;
      }
      setActiveSupplier(null);
      setSupForm({
        id: "",
        name: "",
        nit: "",
        phone: "",
        email: "",
        address: "",
        active: true,
      });
    }
    setSupModalOpen(true);
  };

  const handleSupFieldChange = (field: string, value: any) => {
    const updated = { ...supForm, [field]: value };
    setSupForm(updated);
    if (supSubmitAttempted || supTouchedFields[field]) {
      const errors = validateSupplierForm(updated);
      setSupFormErrors(errors);
    }
  };

  const handleSupFieldBlur = (field: string) => {
    setSupTouchedFields((prev) => ({ ...prev, [field]: true }));
    const errors = validateSupplierForm(supForm);
    setSupFormErrors(errors);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSupplier && !canEditSupplier) {
      showToast("Permiso denegado: No tiene permisos para editar proveedores.", "error");
      return;
    }
    if (!activeSupplier && !canCreateSupplier) {
      showToast("Permiso denegado: No tiene permisos para crear proveedores.", "error");
      return;
    }

    setSupSubmitAttempted(true);
    const errors = validateSupplierForm();
    setSupFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast("Existen errores en el formulario de proveedor. Revise los campos marcados.", "error");
      return;
    }

    const updated = upsertSupplier({
      ...supForm,
      name: supForm.name.trim(),
      nit: supForm.nit.trim(),
      phone: supForm.phone.trim(),
      email: supForm.email.trim(),
      address: supForm.address.trim(),
    });
    showToast(`Proveedor "${updated.name}" guardado correctamente.`, "success");
    setSupModalOpen(false);
    loadData();
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    if (!canDeleteSupplier) {
      showToast("Permiso denegado: No tiene permisos para eliminar proveedores.", "warning");
      return;
    }
    showConfirm({
      title: "Eliminar Proveedor",
      message: `¿Está seguro de que desea eliminar al proveedor "${supplier.name}"? Se mantendrán los registros históricos de compras existentes.`,
      confirmText: "Eliminar Proveedor",
      severity: "danger",
      onConfirm: () => {
        deleteSupplier(supplier.id);
        showToast("Proveedor removido correctamente.", "success");
        loadData();
      },
    });
  };

  // Open Purchase registering Modal
  const openPurModal = () => {
    if (!canRecordPurchase) {
      showToast("Permiso denegado: No tiene permisos para registrar facturas de compra.", "warning");
      return;
    }
    if (suppliers.length === 0) {
      showToast("Debe registrar al menos un proveedor antes de ingresar compras.", "warning");
      return;
    }
    setSelectedSupplierId(suppliers[0]?.id || "");
    setPurchaseItems([]);
    setTempProduct(products[0]?.id || "");
    setTempQty(1);
    setTempCost(products[0]?.purchasePrice || 0);
    setPurModalOpen(true);
  };

  // Sync temp price when product changes in purchase form
  useEffect(() => {
    if (tempProduct) {
      const prod = products.find((p) => p.id === tempProduct);
      if (prod) {
        setTempCost(prod.purchasePrice);
      }
    }
  }, [tempProduct, products]);

  const handleAddPurchaseLine = () => {
    if (!tempProduct) return;
    const prod = products.find((p) => p.id === tempProduct);
    if (!prod) return;

    // Check if product already added
    const existingIdx = purchaseItems.findIndex((item) => item.productId === tempProduct);
    if (existingIdx >= 0) {
      const updated = [...purchaseItems];
      updated[existingIdx].qty += Number(tempQty);
      updated[existingIdx].cost = Number(tempCost);
      setPurchaseItems(updated);
    } else {
      setPurchaseItems([
        ...purchaseItems,
        {
          productId: prod.id,
          name: prod.name,
          qty: Number(tempQty),
          cost: Number(tempCost),
        },
      ]);
    }
    showToast(`Agregado: ${prod.name} x ${tempQty}`, "success");
  };

  const handleRemovePurchaseLine = (index: number) => {
    const updated = purchaseItems.filter((_, idx) => idx !== index);
    setPurchaseItems(updated);
  };

  const purchaseTotal = useMemo(() => {
    return purchaseItems.reduce((sum, item) => sum + item.qty * item.cost, 0);
  }, [purchaseItems]);

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      showToast("Debe agregar al menos un producto a la orden de compra.", "warning");
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) return;

    showConfirm({
      title: "Registrar Abastecimiento",
      message: `¿Desea asentar esta orden de abastecimiento por un total de ${formatCOP(
        purchaseTotal
      )}? Las existencias en inventario de los productos comprados aumentarán automáticamente de inmediato.`,
      confirmText: "Asentar Abastecimiento",
      severity: "info",
      onConfirm: () => {
        // Register the purchase outlays
        recordPurchaseInvoice({
          id: "",
          invoiceNumber: `COMP-${Date.now()}`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: purchaseItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            qty: item.qty,
            purchasePrice: item.cost,
            total: item.qty * item.cost,
          })),
          total: purchaseTotal,
          createdAt: new Date().toISOString(),
        });

        // Update product stock counts in database
        const storedProducts = getProducts();
        purchaseItems.forEach((pItem) => {
          const matchProd = storedProducts.find((p) => p.id === pItem.productId);
          if (matchProd) {
            matchProd.stock += pItem.qty;
          }
        });
        saveProducts(storedProducts);

        showToast("Abastecimiento registrado. Inventarios actualizados de inmediato.", "success");
        setPurModalOpen(false);
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
            <Truck className="w-5.5 h-5.5 text-indigo-600" /> Abastecimiento y Proveedores
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión del directorio de proveedores comerciales y registro de compras de inventario para reabastecer stock.
          </p>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openSupModal(null)}
            disabled={!canCreateSupplier}
            title={!canCreateSupplier ? "Permiso denegado: No tiene permisos para registrar proveedores." : "Registrar Proveedor"}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              !canCreateSupplier
                ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Registrar Proveedor
          </button>
          
          <button
            onClick={openPurModal}
            disabled={!canRecordPurchase}
            title={!canRecordPurchase ? "Permiso denegado: No tiene permisos para registrar facturas de compra." : "Registrar Compra"}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
              !canRecordPurchase
                ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed opacity-60"
                : "text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 cursor-pointer"
            }`}
          >
            <Plus className="w-4 h-4" /> Registrar Compra (Factura Proveedor)
          </button>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab("catalog");
            setSearch("");
          }}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "catalog"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Truck className="w-4 h-4" /> Directorio Proveedores ({suppliers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("purchases");
            setSearch("");
          }}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "purchases"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Receipt className="w-4 h-4" /> Facturas de Compra ({purchases.length})
        </button>
      </div>

      {/* SEARCH BOX CARDS */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-4">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder={activeTab === "catalog" ? "Buscar por razón social, NIT..." : "Buscar por ID compra o proveedor..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </div>
      </div>

      {/* CATALOG PANEL */}
      {activeTab === "catalog" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                  <th className="py-3.5 px-6">Identificación / NIT</th>
                  <th className="py-3.5 px-6">Razón Social / Proveedor</th>
                  <th className="py-3.5 px-6">Canales de Contacto</th>
                  <th className="py-3.5 px-6">Dirección Fiscal</th>
                  <th className="py-3.5 px-6 text-center">Estado</th>
                  <th className="py-3.5 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      No se registran proveedores coincidentes.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 tracking-tight">{s.nit}</td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800 leading-tight">{s.name}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">Creado: {new Date(s.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 opacity-60" /> {s.phone}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] opacity-80">
                            <Mail className="w-3 h-3 opacity-60" /> {s.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium">{s.address}</td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {s.active ? "Activo" : "Pausado"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openSupModal(s)}
                            disabled={!canEditSupplier}
                            title={!canEditSupplier ? "Permiso denegado: No tiene permisos para editar proveedores." : "Editar Datos"}
                            className={`p-1.5 rounded-lg transition-all ${
                              !canEditSupplier
                                ? "text-slate-300 cursor-not-allowed opacity-50"
                                : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(s)}
                            disabled={!canDeleteSupplier}
                            title={!canDeleteSupplier ? "Permiso denegado: No tiene permisos para eliminar proveedores." : "Remover Proveedor"}
                            className={`p-1.5 rounded-lg transition-all ${
                              !canDeleteSupplier
                                ? "text-slate-300 cursor-not-allowed opacity-50"
                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PURCHASES LOG PANEL */}
      {activeTab === "purchases" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                  <th className="py-3.5 px-6">ID Compra / Soporte</th>
                  <th className="py-3.5 px-6">Proveedor Relacionado</th>
                  <th className="py-3.5 px-6">Fecha Adquisición</th>
                  <th className="py-3.5 px-6">Detalles de Orden (Artículos)</th>
                  <th className="py-3.5 px-6">Medio Egreso</th>
                  <th className="py-3.5 px-6 text-right">Monto Total Liquidado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      No se registran compras ni reabastecimientos vigentes.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 tracking-tight">{p.id}</td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800 leading-tight">{p.supplierName}</p>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 opacity-60" /> {formatDateCO(p.createdAt)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex flex-col gap-1 max-w-xs">
                          {p.items.map((it, idx) => (
                            <span key={idx} className="text-[10px] text-slate-500 block">
                              • {it.name} ({it.qty} u. x {formatCOP(it.price)})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-600">
                        {p.paymentMethod === "CASH" ? "Caja Mayor (Efectivo)" : "Transferencia de Banco"}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-rose-600">
                        {formatCOP(p.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {supModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {activeSupplier ? "Modificar Ficha Proveedor" : "Crear Ficha Proveedor"}
              </h3>
              <button
                type="button"
                onClick={() => setSupModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 flex flex-col gap-4">
              {/* Alert Summary Box */}
              {supSubmitAttempted && Object.keys(supFormErrors).length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-800 dark:text-rose-200">
                    <strong className="font-bold block mb-0.5">Corrige los errores antes de guardar:</strong>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {Object.values(supFormErrors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Name field */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nombre Comercial / Proveedor *
                </label>
                <input
                  type="text"
                  value={supForm.name}
                  onChange={(e) => handleSupFieldChange("name", e.target.value)}
                  onBlur={() => handleSupFieldBlur("name")}
                  className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                    supFormErrors.name && (supTouchedFields.name || supSubmitAttempted)
                      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                  }`}
                  placeholder="Ej. Distribuidora Nacional de Harinas"
                />
                {supFormErrors.name && (supTouchedFields.name || supSubmitAttempted) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{supFormErrors.name}</span>
                  </div>
                )}
              </div>

              {/* NIT & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    NIT Proveedor *
                  </label>
                  <input
                    type="text"
                    value={supForm.nit}
                    onChange={(e) => handleSupFieldChange("nit", e.target.value)}
                    onBlur={() => handleSupFieldBlur("nit")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      supFormErrors.nit && (supTouchedFields.nit || supSubmitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="Ej. 901543-3"
                  />
                  {supFormErrors.nit && (supTouchedFields.nit || supSubmitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{supFormErrors.nit}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Teléfono Fijo / Celular
                  </label>
                  <input
                    type="text"
                    value={supForm.phone}
                    onChange={(e) => handleSupFieldChange("phone", e.target.value)}
                    onBlur={() => handleSupFieldBlur("phone")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      supFormErrors.phone && (supTouchedFields.phone || supSubmitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="Ej. 601323..."
                  />
                  {supFormErrors.phone && (supTouchedFields.phone || supSubmitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{supFormErrors.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Correo de Pedidos / Compras
                </label>
                <input
                  type="email"
                  value={supForm.email}
                  onChange={(e) => handleSupFieldChange("email", e.target.value)}
                  onBlur={() => handleSupFieldBlur("email")}
                  className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                    supFormErrors.email && (supTouchedFields.email || supSubmitAttempted)
                      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                  }`}
                  placeholder="pedidos@proveedor.com"
                />
                {supFormErrors.email && (supTouchedFields.email || supSubmitAttempted) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{supFormErrors.email}</span>
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Dirección de Oficina / Centro Distribución
                </label>
                <input
                  type="text"
                  value={supForm.address}
                  onChange={(e) => handleSupFieldChange("address", e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                  placeholder="Zona industrial o bodega..."
                />
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSupModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPRA DE ABASTECIMIENTO REGISTERING MODAL */}
      {purModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <PlusCircle className="w-5 h-5 text-indigo-600" /> Registrar Compra (Entrada de Inventario)
              </h3>
              <button onClick={() => setPurModalOpen(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Select supplier */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Proveedor Comercial *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (NIT: {s.nit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Caja de Salida</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="CASH">Caja de Efectivo (Caja Mayor)</option>
                    <option value="TRANSFER">Cuenta Bancaria (Banco)</option>
                  </select>
                </div>
              </div>

              {/* ITEM ADDER FORMBLOCK */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Agregar Artículo a Compra
                </span>

                <div className="grid grid-cols-4 gap-3 items-end">
                  {/* Product */}
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Producto</label>
                    <select
                      value={tempProduct}
                      onChange={(e) => setTempProduct(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.barcode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={tempQty}
                      onChange={(e) => setTempQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Costo Unitario (COP)</label>
                    <input
                      type="number"
                      min={0}
                      value={tempCost}
                      onChange={(e) => setTempCost(Math.max(0, Number(e.target.value)))}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddPurchaseLine}
                  className="py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Incluir en Orden
                </button>
              </div>

              {/* LIST OF CURRENT ADDED LINES */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                  Artículos en Orden de Abastecimiento ({purchaseItems.length})
                </span>

                {purchaseItems.length === 0 ? (
                  <p className="text-[10px] text-slate-400 py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Ningún artículo agregado a la orden de compra.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {purchaseItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 border border-slate-100 rounded-xl flex items-center justify-between text-xs bg-white"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {item.qty} u. x {formatCOP(item.cost)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-950">{formatCOP(item.qty * item.cost)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseLine(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total output block */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-bold">VALOR TOTAL DE COMPRA:</span>
                <span className="text-base font-black text-rose-600">{formatCOP(purchaseTotal)}</span>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPurModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Asentar Compra y Cargar Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
