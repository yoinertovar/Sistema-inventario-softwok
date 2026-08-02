import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSmartWorkspace } from "../../context/SmartWorkspaceContext";
import { useUiFeedback } from "../../context/UiFeedbackContext";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { PERMISSIONS } from "../../permissions/PermissionConstants";
import { getProducts, saveProducts, Product } from "../../services/product.service";
import { getClients, upsertClient, saveClients, Client } from "../../services/client.service";
import { createInvoice as addInvoice, Invoice } from "../../services/invoice.service";
import { formatCOP } from "../../utils/colombia";
import { COMPANY_CONFIG } from "../../config/config";
import { readJSON, writeJSON } from "../../services/storage.service";
import {
  ShoppingBag,
  Plus,
  Minus,
  Search,
  Users,
  CreditCard,
  Trash2,
  CheckCircle,
  Coins,
  X,
  UserPlus,
  ArrowRight,
  Barcode,
  Sparkles,
  Printer,
  ChevronDown,
  Pause,
  Clock,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

interface ParkedInvoice {
  id: string;
  parkedAt: string;
  items: {
    productId: string;
    name: string;
    qty: number;
    price: number;
    taxRate: number;
    total: number;
  }[];
  client: Client;
  paymentMethod: "CASH" | "CARD" | "NEQUI_DAVIPLATA" | "CREDIT";
  total: number;
}

export const SmartWorkspace: React.FC = () => {
  const { user } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  // Sub-permissions
  const canCreateInvoice = hasPermission(user, PERMISSIONS.ACCESS_POS);
  const canCreateClient = hasPermission(user, PERMISSIONS.CREATE_CLIENT);
  const {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTabId,
    updateTabItems,
    updateTabClient,
    updateTabPayment,
    clearTab
  } = useSmartWorkspace();

  // Core database states
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Filtering catalog
  const [catSearch, setCatSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Quick Client Registering modal & validation
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    nitOrCc: "",
    phone: "",
    email: "",
    address: "",
    creditLimit: 0,
  });

  const [quickClientErrors, setQuickClientErrors] = useState<Record<string, string>>({});
  const [quickClientTouched, setQuickClientTouched] = useState<Record<string, boolean>>({});
  const [quickClientSubmitAttempted, setQuickClientSubmitAttempted] = useState(false);

  const validateQuickClient = (formData = newClientForm) => {
    const errors: Record<string, string> = {};

    // 1. Name
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = "El nombre o razón social es obligatorio.";
    } else if (trimmedName.length < 3) {
      errors.name = "El nombre debe contener al menos 3 caracteres.";
    } else if (/^\d+$/.test(trimmedName)) {
      errors.name = "El nombre no puede componerse solo de números.";
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
        (c) => c.nitOrCc.toLowerCase() === trimmedNit.toLowerCase()
      );
      if (duplicate) {
        errors.nitOrCc = `Ya existe un cliente con este documento (${duplicate.name}).`;
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
      errors.creditLimit = "El cupo excede el máximo permitido ($1,000,000,000 COP).";
    }

    return errors;
  };

  // Searchable client selector states
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Close client dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Received CASH change calculator helpers
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Barcode input simulator
  const [barcodeQuery, setBarcodeQuery] = useState("");

  // Print Thermal invoice ticket popup
  const [justBilledInvoice, setJustBilledInvoice] = useState<Invoice | null>(null);

  // Parked/Held Invoices list state
  const [parkedInvoices, setParkedInvoices] = useState<ParkedInvoice[]>(() =>
    readJSON<ParkedInvoice[]>("softwork_parked_invoices", [])
  );

  // Input refs for keyboard quick focus
  const catalogSearchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts for POS operations
  useKeyboardShortcuts([
    {
      key: "s",
      ctrl: true,
      description: "Enfocar buscador del catálogo / simular escáner",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        catalogSearchInputRef.current?.focus();
        catalogSearchInputRef.current?.select();
        showToast("Buscador de catálogo enfocado (Listo para escribir o escanear)", "info");
      },
    },
    {
      key: "n",
      ctrl: true,
      description: "Nueva Factura (Limpiar carrito de compras)",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        if (activeTab && activeTab.items.length > 0) {
          showConfirm({
            title: "Nueva Factura (Atajo Ctrl+N)",
            message: "¿Está seguro de que desea limpiar todos los productos del carrito actual para iniciar una nueva factura?",
            confirmText: "Limpiar y Empezar",
            severity: "danger",
            onConfirm: () => {
              clearTab(activeTab.id);
              setCashReceived(0);
              showToast("Carrito vaciado. Nueva factura iniciada.", "info");
            }
          });
        } else {
          showToast("El carrito ya está vacío.", "info");
        }
      },
    },
    {
      key: "o",
      alt: true,
      description: "Registro rápido y asociación de nuevo cliente",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        setClientModalOpen(true);
      },
    },
    {
      key: "p",
      alt: true,
      description: "Poner Factura en Espera (Park/Hold)",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        parkActiveInvoice();
      },
    },
    {
      key: "1",
      alt: true,
      description: "Seleccionar método de pago: Efectivo",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        if (activeTab) {
          updateTabPayment(activeTab.id, "CASH");
          setCashReceived(0);
          showToast("Método de pago seleccionado: Efectivo", "success");
        }
      },
    },
    {
      key: "2",
      alt: true,
      description: "Seleccionar método de pago: Tarjeta",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        if (activeTab) {
          updateTabPayment(activeTab.id, "CARD");
          setCashReceived(0);
          showToast("Método de pago seleccionado: Tarjeta Débito/Crédito", "success");
        }
      },
    },
    {
      key: "3",
      alt: true,
      description: "Seleccionar método de pago: Nequi/Daviplata",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        if (activeTab) {
          updateTabPayment(activeTab.id, "NEQUI_DAVIPLATA");
          setCashReceived(0);
          showToast("Método de pago seleccionado: Nequi / Daviplata", "success");
        }
      },
    },
    {
      key: "4",
      alt: true,
      description: "Seleccionar método de pago: Crédito de Cartera",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        if (activeTab) {
          updateTabPayment(activeTab.id, "CREDIT");
          setCashReceived(0);
          showToast("Método de pago seleccionado: Crédito de Cartera", "success");
        }
      },
    },
    {
      key: "Enter",
      ctrl: true,
      description: "Procesar y finalizar checkout (Facturar)",
      category: "Terminal POS",
      preventDefault: true,
      allowInInputs: true,
      action: () => {
        handleCheckoutSubmit();
      },
    },
  ]);

  const loadData = () => {
    setProducts(getProducts().filter((p) => p.active));
    setClients(getClients().filter((c) => c.active));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Retrieve current active workspace tab
  const activeTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (activeTab?.client) {
      setClientSearchQuery(activeTab.client.name);
    }
  }, [activeTab?.client]);

  // Filter products for the sidebar catalog grid
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchText =
        p.name.toLowerCase().includes(catSearch.toLowerCase()) || p.barcode.includes(catSearch);
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      return matchText && matchCat;
    });
  }, [products, catSearch, selectedCategory]);

  // Filter clients for the searchable client select
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery || (activeTab && clientSearchQuery === activeTab.client.name)) {
      return clients;
    }
    const cleanQuery = clientSearchQuery.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(cleanQuery) ||
        c.nitOrCc.includes(cleanQuery)
    );
  }, [clients, clientSearchQuery, activeTab]);

  // Calculations for current workspace basket
  const basketTotals = useMemo(() => {
    if (!activeTab) return { subtotal: 0, taxAmount: 0, total: 0 };

    let subtotal = 0;
    let taxAmount = 0;

    activeTab.items.forEach((item) => {
      const lineTotal = item.qty * item.price;
      // Formula: Tax amount = total_with_tax - (total_with_tax / (1 + tax_rate_percent / 100))
      const rate = item.taxRate || 19;
      const lineSubtotal = lineTotal / (1 + rate / 100);
      const lineTax = lineTotal - lineSubtotal;

      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });

    const total = subtotal + taxAmount;

    return {
      subtotal: Math.round(subtotal),
      taxAmount: Math.round(taxAmount),
      total: Math.round(total),
    };
  }, [activeTab]);

  // Handle adding product from click catalog
  const handleAddProduct = (product: Product) => {
    if (!activeTab) return;
    
    if (product.stock <= 0) {
      showToast(`El producto "${product.name}" se encuentra agotado temporalmente.`, "warning");
      return;
    }

    const existingItem = activeTab.items.find((item) => item.productId === product.id);
    const currentQty = existingItem ? existingItem.qty : 0;

    if (currentQty >= product.stock) {
      showToast(`No puedes agregar más unidades. Supera el stock disponible (${product.stock} u.).`, "warning");
      return;
    }

    const updatedItems = [...activeTab.items];
    if (existingItem) {
      existingItem.qty += 1;
      existingItem.total = existingItem.qty * existingItem.price;
    } else {
      updatedItems.push({
        productId: product.id,
        name: product.name,
        qty: 1,
        price: product.salePrice,
        taxRate: product.taxRate,
        total: product.salePrice,
      });
    }

    updateTabItems(activeTab.id, updatedItems);
  };

  // Adjust basket quantities
  const handleUpdateQty = (productId: string, newQty: number) => {
    if (!activeTab) return;
    
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (newQty <= 0) {
      // Remove item
      const filtered = activeTab.items.filter((item) => item.productId !== productId);
      updateTabItems(activeTab.id, filtered);
      return;
    }

    if (newQty > prod.stock) {
      showToast(`Cantidad supera las existencias disponibles del producto (${prod.stock} u.).`, "warning");
      return;
    }

    const updated = activeTab.items.map((item) => {
      if (item.productId === productId) {
        item.qty = newQty;
        item.total = newQty * item.price;
      }
      return item;
    });

    updateTabItems(activeTab.id, updated);
  };

  // Barcode Simulator scanner
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    const match = products.find((p) => p.barcode === barcodeQuery.trim());
    if (match) {
      handleAddProduct(match);
      setBarcodeQuery("");
      showToast(`Código de barras leído: ${match.name}`, "success");
    } else {
      showToast(`No se encontró producto con código de barras "${barcodeQuery}"`, "error");
    }
  };

  // Quick Client register save & handlers
  const handleQuickClientFieldChange = (field: string, value: any) => {
    const updated = { ...newClientForm, [field]: value };
    setNewClientForm(updated);
    if (quickClientSubmitAttempted || quickClientTouched[field]) {
      const errors = validateQuickClient(updated);
      setQuickClientErrors(errors);
    }
  };

  const handleQuickClientFieldBlur = (field: string) => {
    setQuickClientTouched((prev) => ({ ...prev, [field]: true }));
    const errors = validateQuickClient(newClientForm);
    setQuickClientErrors(errors);
  };

  const handleQuickSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateClient) {
      showToast("Permiso denegado: No tiene permisos para registrar nuevos clientes.", "error");
      return;
    }

    setQuickClientSubmitAttempted(true);
    const errors = validateQuickClient();
    setQuickClientErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast("Por favor corrija los campos con error antes de guardar.", "error");
      return;
    }

    const created = upsertClient({
      id: `cli-${Date.now()}`,
      name: newClientForm.name.trim(),
      nitOrCc: newClientForm.nitOrCc.trim(),
      phone: newClientForm.phone.trim() || "N/A",
      email: newClientForm.email.trim() || "",
      address: newClientForm.address.trim() || "",
      creditLimit: Number(newClientForm.creditLimit),
      creditBalance: 0,
      active: true,
      createdAt: new Date().toISOString(),
    });

    // Refresh client lists
    loadData();
    // Select newly created client inside current POS workspace tab!
    updateTabClient(activeTab.id, created);
    setClientModalOpen(false);
    showToast(`Cliente "${created.name}" registrado y asociado a la cuenta.`, "success");
  };

  const openNewClientModal = (initialName: string = "") => {
    if (!canCreateClient) {
      showToast("Permiso denegado: No tiene permisos para registrar nuevos clientes.", "warning");
      return;
    }
    setQuickClientErrors({});
    setQuickClientTouched({});
    setQuickClientSubmitAttempted(false);
    setNewClientForm({
      name: initialName,
      nitOrCc: "",
      phone: "",
      email: "",
      address: "",
      creditLimit: 0,
    });
    setClientModalOpen(true);
  };

  function parkActiveInvoice() {
    if (!activeTab || activeTab.items.length === 0) {
      showToast("La canasta de esta pestaña está vacía. No hay productos para poner en espera.", "warning");
      return;
    }

    const newParked: ParkedInvoice = {
      id: `park-${Date.now()}`,
      parkedAt: new Date().toISOString(),
      items: [...activeTab.items],
      client: { ...activeTab.client },
      paymentMethod: activeTab.paymentMethod,
      total: basketTotals.total
    };

    const updated = [newParked, ...parkedInvoices];
    setParkedInvoices(updated);
    writeJSON("softwork_parked_invoices", updated);

    // Clear current tab so cashier can immediately serve the next customer!
    clearTab(activeTab.id);
    setCashReceived(0);

    showToast(`Factura de "${newParked.client.name}" puesta en espera exitosamente.`, "success");
  }

  function restoreParkedInvoice(parked: ParkedInvoice) {
    if (!activeTab) return;

    const performRestore = () => {
      updateTabItems(activeTab.id, parked.items);
      updateTabClient(activeTab.id, parked.client);
      updateTabPayment(activeTab.id, parked.paymentMethod);
      
      // Remove from parked invoices
      const updated = parkedInvoices.filter((p) => p.id !== parked.id);
      setParkedInvoices(updated);
      writeJSON("softwork_parked_invoices", updated);
      
      setCashReceived(0);
      showToast(`Factura de "${parked.client.name}" recuperada en la pestaña actual.`, "success");
    };

    if (activeTab.items.length > 0) {
      showConfirm({
        title: "Recuperar Factura",
        message: "La pestaña actual tiene productos agregados. ¿Desea sobrescribir la canasta actual con la factura en espera?",
        confirmText: "Sobrescribir",
        severity: "warning",
        onConfirm: performRestore,
      });
    } else {
      performRestore();
    }
  }

  function deleteParkedInvoice(id: string, clientName: string) {
    showConfirm({
      title: "Eliminar Factura en Espera",
      message: `¿Está seguro de que desea descartar definitivamente la factura en espera de "${clientName}"?`,
      confirmText: "Descartar",
      severity: "danger",
      onConfirm: () => {
        const updated = parkedInvoices.filter((p) => p.id !== id);
        setParkedInvoices(updated);
        writeJSON("softwork_parked_invoices", updated);
        showToast("Factura en espera descartada.", "info");
      }
    });
  }

  // Change vueltas calculators
  const vueltasChange = useMemo(() => {
    const diff = cashReceived - basketTotals.total;
    return diff < 0 ? 0 : diff;
  }, [cashReceived, basketTotals.total]);

  const quickCashOptions = [10000, 20000, 50000, 100000];

  // Checkout process submit
  const handleCheckoutSubmit = () => {
    if (!canCreateInvoice) {
      showToast("Permiso denegado: No tiene permisos para emitir o facturar ventas.", "warning");
      return;
    }
    if (!activeTab || activeTab.items.length === 0) {
      showToast("El carrito está vacío. Agregue productos antes de facturar.", "warning");
      return;
    }

    // 1. Credit bounds checks
    if (activeTab.paymentMethod === "CREDIT") {
      const client = clients.find((c) => c.id === activeTab.client.id);
      if (!client) {
        showToast("Seleccione un cliente registrado antes de financiar un crédito.", "error");
        return;
      }
      if (client.id === "cli-consumidor") {
        showToast("El Consumidor Final no puede acumular deudas de crédito. Elija un cliente de cartera registrado.", "warning");
        return;
      }

      const currentBalance = client.creditBalance || 0;
      const assignedLimit = client.creditLimit || 0;
      if (currentBalance + basketTotals.total > assignedLimit) {
        showConfirm({
          title: "Cupo de Crédito Excedido",
          message: `La factura de ${formatCOP(
            basketTotals.total
          )} superará el cupo disponible de "${client.name}" (${formatCOP(
            assignedLimit - currentBalance
          )}). ¿Desea anular la transacción o solicitar autorización administrativa?`,
          confirmText: "Solicitar Cupo Especial",
          severity: "danger",
          onConfirm: () => {
            showToast("Cupo de crédito especial aprobado provisionalmente por administrador.", "info");
            processInvoiceBilled();
          },
        });
        return;
      }
    }

    // Cash checkouts checks
    if (activeTab.paymentMethod === "CASH" && cashReceived > 0 && cashReceived < basketTotals.total) {
      showToast("El efectivo recibido es menor que el valor total a pagar.", "error");
      return;
    }

    processInvoiceBilled();
  };

  const processInvoiceBilled = () => {
    // 2. Build invoice payload
    const billedInvoice = addInvoice({
      client: {
        id: activeTab.client.id,
        name: activeTab.client.name,
        nitOrCc: activeTab.client.nitOrCc,
      },
      paymentMethod: activeTab.paymentMethod,
      items: activeTab.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        price: it.price,
        taxRate: it.taxRate,
        total: it.total,
      })),
      subtotal: basketTotals.subtotal,
      taxAmount: basketTotals.taxAmount,
      total: basketTotals.total,
      status: "PAID",
      sellerId: user?.id || "usr-cajero",
      sellerName: user?.name || "Cajero Principal",
      receivedAmount: activeTab.paymentMethod === "CASH" ? (cashReceived || basketTotals.total) : basketTotals.total,
      changeAmount: activeTab.paymentMethod === "CASH" ? vueltasChange : 0,
    });

    // 3. Decrement live stock counts
    const storedProducts = getProducts();
    activeTab.items.forEach((basketItem) => {
      const matchProduct = storedProducts.find((p) => p.id === basketItem.productId);
      if (matchProduct) {
        matchProduct.stock = Math.max(0, matchProduct.stock - basketItem.qty);
      }
    });
    saveProducts(storedProducts);

    // If credit payment, increment client's debt balance
    if (activeTab.paymentMethod === "CREDIT") {
      const storedClients = getClients();
      const clientMatch = storedClients.find((c) => c.id === activeTab.client.id);
      if (clientMatch) {
        clientMatch.creditBalance = (clientMatch.creditBalance || 0) + basketTotals.total;
        // Save client accounts
        saveClients(storedClients);
      }
    }

    showToast(`Venta exitosa. Factura ${billedInvoice.id} registrada en el diario.`, "success");

    // Open print ticket overlay
    setJustBilledInvoice(billedInvoice);
    
    // Clear the completed workspace tab basket and reset calculator
    clearTab(activeTab.id);
    setCashReceived(0);
    loadData();
  };

  const handlePrintTicketAndClose = () => {
    // Trigger browser print
    const printContent = document.getElementById("thermal-print-just-billed");
    if (!printContent) return;

    const prtWin = window.open("about:blank", "PrintJustBilled", "width=400,height=600");
    if (prtWin) {
      prtWin.document.write(`
        <html>
          <head>
            <title>Imprimir Recibo</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 11px; margin: 10px; }
              .text-center { text-align: center; }
              .divider { border-top: 1px dashed #000; margin: 5px 0; }
              table { width: 100%; font-size: 10px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      prtWin.document.close();
    }
    setJustBilledInvoice(null);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-5 animate-fade-in relative">
      
      {/* LEFT COLUMN: ACTIVE PRODUCTS CATALOG GRID & WORKSPACES BAR */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
        {/* MULTI-TAB WORKSPACE NAVIGATION HEADER BAR */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[80%] pr-2">
            {tabs.map((tab, idx) => (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setCashReceived(0);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all shrink-0 flex items-center gap-2 border ${
                  activeTabId === tab.id
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm font-extrabold"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Tab {idx + 1}: {tab.client.name.split(" ")[0]}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tab.id);
                      setCashReceived(0);
                    }}
                    className={`p-0.5 rounded-full hover:bg-black/10 ${
                      activeTabId === tab.id ? "text-indigo-200 hover:text-white" : "text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => addTab()}
            disabled={tabs.length >= 8}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 disabled:opacity-40 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva Factura
          </button>
        </div>

        {/* FACTURAS EN ESPERA (PARKED/HOLD INVOICES) SHELF */}
        {parkedInvoices.length > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-2.5 flex flex-col gap-1.5 shrink-0 animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" /> Facturas Retenidas en Espera ({parkedInvoices.length})
              </span>
              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold hidden sm:inline">Haz clic sobre una tarjeta para recuperarla inmediatamente</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {parkedInvoices.map((parked) => (
                <div
                  key={parked.id}
                  onClick={() => restoreParkedInvoice(parked)}
                  className="bg-white dark:bg-slate-900 hover:bg-amber-50/45 dark:hover:bg-slate-800 border border-amber-100 dark:border-amber-900/40 px-3 py-1.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all shadow-xs hover:shadow-sm shrink-0 select-none group border-l-4 border-l-amber-500"
                  title="Haga clic para recuperar esta factura"
                >
                  <div className="p-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg group-hover:bg-amber-100">
                    <Pause className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none truncate max-w-[120px]">
                      {parked.client.name.split(" ")[0]} {parked.client.name.split(" ")[1] || ""}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                      {parked.items.length} {parked.items.length === 1 ? 'item' : 'items'} • <strong className="text-indigo-600 dark:text-indigo-400">{formatCOP(parked.total)}</strong>
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteParkedInvoice(parked.id, parked.client.name);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-all ml-1.5 cursor-pointer"
                    title="Descartar esta factura en espera"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BARCODE SCANNER SIMULATOR INPUT */}
        <form
          onSubmit={handleBarcodeSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-xs shrink-0"
        >
          <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-100 dark:border-slate-700">
            <Barcode className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Simular Escáner Barcode: Digite el código de barras y pulse ENTER..."
            value={barcodeQuery}
            onChange={(e) => setBarcodeQuery(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-2 text-xs font-mono font-bold tracking-tight"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors"
          >
            Escanear
          </button>
        </form>

        {/* SEARCH AND GRID CATALOG SIDE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 flex-1 overflow-hidden shadow-xs">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Search */}
            <div className="relative w-full sm:flex-1">
              <input
                ref={catalogSearchInputRef}
                type="text"
                placeholder="Buscar por marca o nombre... (Ctrl+S)"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg text-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
            </div>

            {/* Quick selector filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-40 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg text-xs"
            >
              <option value="all">Todas Categorías</option>
              {Array.from(new Set(products.map((p) => p.category))).map((catId: string) => (
                <option key={catId} value={catId}>
                  {catId.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* GRID OF CATALOG PRODUCTS */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pr-1">
            {filteredProducts.map((p) => {
              const isLowStock = p.stock <= p.minStock;
              const isExhausted = p.stock <= 0;

              return (
                <div
                  key={p.id}
                  onClick={() => handleAddProduct(p)}
                  className={`border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between items-start cursor-pointer group transition-all text-left relative overflow-hidden bg-slate-50/20 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 ${
                    isExhausted ? "opacity-50 hover:bg-transparent" : ""
                  }`}
                >
                  <div className="w-full">
                    {/* Stock badge */}
                    <span
                      className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider block w-fit ${
                        isExhausted
                          ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300"
                          : isLowStock
                          ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                          : "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300"
                      }`}
                    >
                      Stock: {p.stock}
                    </span>

                    <h5 className="text-xs font-bold text-slate-800 dark:text-white leading-snug mt-2.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {p.name}
                    </h5>
                  </div>

                  <div className="w-full flex items-center justify-between mt-4">
                    <span className="text-xs font-black text-slate-950 dark:text-white">
                      {formatCOP(p.salePrice)}
                    </span>
                    <div className="p-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 group-hover:bg-indigo-600 group-hover:text-white rounded-lg transition-all">
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: CURRENT CART INACTIVE BASKET & TOTALS DETAILS SHEET */}
      <div className="w-full lg:w-[380px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl rounded-3xl p-5 flex flex-col justify-between h-full overflow-hidden shrink-0">
        
        {/* TOP: ACTIVE BASKET LINE ENTRIES */}
        <div className="flex flex-col gap-4 overflow-hidden flex-1 mb-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h4 className="text-sm font-black text-slate-950 dark:text-white flex items-center gap-1">
                <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Carrito de Venta
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Detalle de los artículos cargados</p>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={parkActiveInvoice}
                disabled={!activeTab || activeTab.items.length === 0}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-30 disabled:bg-transparent disabled:text-slate-400 px-2 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer"
                title="Poner factura en espera (Alt+P)"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Retener</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activeTab && activeTab.items.length > 0) {
                    showConfirm({
                      title: "Vaciar Carrito",
                      message: "¿Está seguro de que desea limpiar todos los productos de esta cuenta en atención?",
                      confirmText: "Vaciar",
                      severity: "danger",
                      onConfirm: () => clearTab(activeTab.id),
                    });
                  }
                }}
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="Vaciar Carrito (Ctrl+N)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ACTIVE BASKET LINE LIST SCROLLABLE */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {!activeTab || activeTab.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-20">
                <Sparkles className="w-8 h-8 text-indigo-100 dark:text-indigo-900 mb-2 animate-pulse" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Carrito Vacío</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                  Haga clic sobre los productos del catálogo de la izquierda para agregarlos al recibo.
                </p>
              </div>
            ) : (
              activeTab.items.map((item) => (
                <div
                  key={item.productId}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex-1 pr-3">
                    <p className="font-bold text-slate-800 dark:text-slate-100 leading-snug">{item.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 font-semibold">
                      {formatCOP(item.price)} (IVA {item.taxRate}%)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Controls */}
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.productId, item.qty - 1)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-extrabold text-slate-800 dark:text-white w-6 text-center">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.productId, item.qty + 1)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-extrabold text-slate-900 dark:text-white w-16 text-right shrink-0">
                      {formatCOP(item.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BOTTOM: TRANSACTION CONTROLS & BILLING */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-3 shrink-0">
          
          {/* CLIENT SELECTOR & NEW CLIENT SHORTCUT */}
          <div className="grid grid-cols-5 gap-2 items-center" ref={clientDropdownRef}>
            <div className="col-span-4 relative">
              <span className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase block mb-1">Cliente Receptor</span>
              <div className="relative">
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => {
                    setClientSearchQuery(e.target.value);
                    setIsClientDropdownOpen(true);
                  }}
                  onFocus={() => setIsClientDropdownOpen(true)}
                  placeholder="Buscar o registrar cliente..."
                  className="w-full pl-3 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 font-semibold focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Autocomplete dropdown panel */}
              {isClientDropdownOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg z-50 py-1.5 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      openNewClientModal(clientSearchQuery !== activeTab?.client.name ? clientSearchQuery : "");
                      setIsClientDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1.5 border-b border-slate-50 dark:border-slate-800 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Registrar nuevo cliente inmediatamente</span>
                  </button>

                  {filteredClients.length > 0 ? (
                    filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (activeTab) {
                            updateTabClient(activeTab.id, c);
                            setClientSearchQuery(c.name);
                          }
                          setIsClientDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col transition-colors cursor-pointer ${
                          activeTab?.client.id === c.id ? "bg-indigo-50/40 dark:bg-indigo-950/40 border-l-2 border-indigo-600 pl-2.5 font-semibold" : ""
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-800 dark:text-white">{c.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-400">CC/NIT: {c.nitOrCc} {c.phone && c.phone !== "N/A" ? `• Cel: ${c.phone}` : ""}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                      <p className="font-medium text-slate-400 dark:text-slate-500">No se encontró el cliente "{clientSearchQuery}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          openNewClientModal(clientSearchQuery);
                          setIsClientDropdownOpen(false);
                        }}
                        className="mt-1 text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                      >
                        ¿Deseas agregarlo inmediatamente?
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Register trigger button */}
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => openNewClientModal("")}
                className="p-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-100 dark:border-indigo-800/60 cursor-pointer"
                title="Nuevo Cliente Rápido (Alt+O)"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PAYMENT METHOD DROPDOWN */}
          <div>
            <span className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase block mb-1">Método de Pago</span>
            <select
              value={activeTab?.paymentMethod || "CASH"}
              onChange={(e) => {
                if (activeTab) {
                  updateTabPayment(activeTab.id, e.target.value as any);
                  setCashReceived(0);
                }
              }}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold focus:outline-none"
            >
              <option value="CASH">Efectivo (Alt + 1)</option>
              <option value="CARD">Tarjeta Débito/Crédito (Alt + 2)</option>
              <option value="NEQUI_DAVIPLATA">Nequi / Daviplata (Alt + 3)</option>
              <option value="CREDIT">Crédito Comercial (Alt + 4)</option>
            </select>
          </div>

          {/* CASH CHANGE REGISTER CALCULATOR OR CREDIT INDICATOR */}
          {activeTab?.paymentMethod === "CASH" && activeTab.items.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl flex flex-col gap-2">
              <span className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase block">Asistente de Cambio (Vueltas)</span>
              
              {/* Banknotes suggestions */}
              <div className="flex gap-1">
                {quickCashOptions.map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setCashReceived(bill)}
                    className="flex-1 py-1 text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    ${(bill / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              {/* Received sum input */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8.5px] font-bold text-slate-400 dark:text-slate-400 block mb-0.5">Efectivo Recibido</label>
                  <input
                    type="number"
                    min={0}
                    value={cashReceived || ""}
                    onChange={(e) => setCashReceived(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-400 block mb-0.5">Cambio a Entregar (Vueltas)</span>
                  <div className="w-full px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60 text-xs font-black rounded-lg">
                    {formatCOP(vueltasChange)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab?.paymentMethod === "CREDIT" && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 p-3 rounded-2xl flex flex-col gap-1 text-[10px] text-amber-800 dark:text-amber-300 leading-snug">
              <span className="font-bold uppercase tracking-wider block">Validación de Crédito</span>
              <p>
                Asociado a: <strong className="text-amber-950 dark:text-amber-100">{activeTab.client.name}</strong>
              </p>
              <p>
                Cupo Disponible: <strong>{formatCOP(activeTab.client.creditLimit - activeTab.client.creditBalance)}</strong>
              </p>
            </div>
          )}

          {/* TOTALS BILLING DISPLAY */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col gap-1.5 mt-1 relative overflow-hidden shrink-0 border border-slate-800">
            {/* Ambient decorative blob */}
            <div className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full bg-white/5 blur-lg pointer-events-none" />

            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Subtotal neto:</span>
              <span>{formatCOP(basketTotals.subtotal)}</span>
            </div>
            
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Impuesto IVA (Recaudado):</span>
              <span>{formatCOP(basketTotals.taxAmount)}</span>
            </div>

            <div className="w-full h-px bg-white/10 my-1" />

            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider">Total a Cobrar</span>
              <span className="text-base font-black tracking-tight text-white leading-none">
                {formatCOP(basketTotals.total)}
              </span>
            </div>
          </div>

          <button
            onClick={handleCheckoutSubmit}
            disabled={!canCreateInvoice || !activeTab || activeTab.items.length === 0}
            title={!canCreateInvoice ? "Permiso denegado: No tiene permiso para emitir facturas." : "Confirmar y Emitir Factura POS"}
            className={`w-full py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all mt-1 ${
              !canCreateInvoice || !activeTab || activeTab.items.length === 0
                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none opacity-60"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-600/10 cursor-pointer"
            }`}
          >
            <CheckCircle className="w-4.5 h-4.5" /> Confirmar y Emitir Factura POS (Ctrl+Enter)
          </button>
        </div>
      </div>

      {/* QUICK NEW CLIENT MODAL DRAWER */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <UserPlus className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" /> Registro Rápido de Cliente
              </h3>
              <button
                type="button"
                onClick={() => setClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickSaveClient} className="p-6 flex flex-col gap-4">
              {/* Alert summary banner */}
              {quickClientSubmitAttempted && Object.keys(quickClientErrors).length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-800 dark:text-rose-200">
                    <strong className="font-bold block mb-0.5">Corrige los errores antes de guardar:</strong>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {Object.values(quickClientErrors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={newClientForm.name}
                  onChange={(e) => handleQuickClientFieldChange("name", e.target.value)}
                  onBlur={() => handleQuickClientFieldBlur("name")}
                  className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all focus:outline-none ${
                    quickClientErrors.name && (quickClientTouched.name || quickClientSubmitAttempted)
                      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                  }`}
                  placeholder="Ej. Carlos Albarracín"
                />
                {quickClientErrors.name && (quickClientTouched.name || quickClientSubmitAttempted) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{quickClientErrors.name}</span>
                  </div>
                )}
              </div>

              {/* NIT & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Cédula / NIT *</label>
                  <input
                    type="text"
                    value={newClientForm.nitOrCc}
                    onChange={(e) => handleQuickClientFieldChange("nitOrCc", e.target.value)}
                    onBlur={() => handleQuickClientFieldBlur("nitOrCc")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      quickClientErrors.nitOrCc && (quickClientTouched.nitOrCc || quickClientSubmitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="Ej. 1018223..."
                  />
                  {quickClientErrors.nitOrCc && (quickClientTouched.nitOrCc || quickClientSubmitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{quickClientErrors.nitOrCc}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Celular</label>
                  <input
                    type="text"
                    value={newClientForm.phone}
                    onChange={(e) => handleQuickClientFieldChange("phone", e.target.value)}
                    onBlur={() => handleQuickClientFieldBlur("phone")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      quickClientErrors.phone && (quickClientTouched.phone || quickClientSubmitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="Ej. 310..."
                  />
                  {quickClientErrors.phone && (quickClientTouched.phone || quickClientSubmitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{quickClientErrors.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email & Address */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newClientForm.email}
                    onChange={(e) => handleQuickClientFieldChange("email", e.target.value)}
                    onBlur={() => handleQuickClientFieldBlur("email")}
                    className={`w-full px-4 py-2 border rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all focus:outline-none ${
                      quickClientErrors.email && (quickClientTouched.email || quickClientSubmitAttempted)
                        ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                        : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                    }`}
                    placeholder="ejemplo@correo.com"
                  />
                  {quickClientErrors.email && (quickClientTouched.email || quickClientSubmitAttempted) && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{quickClientErrors.email}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Dirección de Envío</label>
                  <input
                    type="text"
                    value={newClientForm.address}
                    onChange={(e) => handleQuickClientFieldChange("address", e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Calle, avenida..."
                  />
                </div>
              </div>

              {/* Credit limit */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Cupo Crédito Comercial (COP)</label>
                <input
                  type="number"
                  min={0}
                  value={newClientForm.creditLimit || ""}
                  onChange={(e) => handleQuickClientFieldChange("creditLimit", Math.max(0, Number(e.target.value)))}
                  onBlur={() => handleQuickClientFieldBlur("creditLimit")}
                  className={`w-full px-4 py-2 border rounded-xl text-sm font-bold bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none ${
                    quickClientErrors.creditLimit && (quickClientTouched.creditLimit || quickClientSubmitAttempted)
                      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400"
                  }`}
                  placeholder="0 = Solo Contado"
                />
                {quickClientErrors.creditLimit && (quickClientTouched.creditLimit || quickClientSubmitAttempted) && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{quickClientErrors.creditLimit}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setClientModalOpen(false)}
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

      {/* TICKET POPUP ON SUCCESSFUL CHECKOUT */}
      {justBilledInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-zoom-in">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full mb-4 animate-bounce">
                <CheckCircle className="w-8 h-8" />
              </div>
              
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Venta Emitida Correctamente</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">La factura <strong className="text-slate-800 dark:text-slate-200">{justBilledInvoice.id}</strong> ha sido cargada al diario comercial.</p>

              {/* Thermal ticket preview structure */}
              <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mt-5 text-left font-mono text-[10px] text-slate-800 dark:text-slate-200 select-all max-h-56 overflow-y-auto">
                <div id="thermal-print-just-billed">
                  <p className="bold text-center uppercase text-xs">{COMPANY_CONFIG.name}</p>
                  <p className="text-center">NIT: {COMPANY_CONFIG.nit}</p>
                  <p className="text-center">{COMPANY_CONFIG.address}</p>
                  <p className="divider">--------------------------------</p>
                  <p className="bold text-center">FACTURA DE VENTA: {justBilledInvoice.id}</p>
                  <p className="divider">--------------------------------</p>
                  <p>Fecha: {new Date(justBilledInvoice.createdAt).toLocaleString()}</p>
                  <p>Cliente: {justBilledInvoice.client.name}</p>
                  <p>Doc: {justBilledInvoice.client.nitOrCc}</p>
                  <p>Medio Pago: {justBilledInvoice.paymentMethod}</p>
                  <p className="divider">--------------------------------</p>
                  
                  {justBilledInvoice.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{it.name} x {it.qty}</span>
                      <span>{formatCOP(it.total)}</span>
                    </div>
                  ))}
                  
                  <p className="divider">--------------------------------</p>
                  <p className="bold">TOTAL FACTURADO: {formatCOP(justBilledInvoice.total)}</p>
                  <p className="text-center italic mt-2">{COMPANY_CONFIG.receiptFooter}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3 w-full border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setJustBilledInvoice(null)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={handlePrintTicketAndClose}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Lanzar Ticket POS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartWorkspace;
