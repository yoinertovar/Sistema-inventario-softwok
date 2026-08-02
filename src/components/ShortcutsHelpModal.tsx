import React, { useState, useMemo } from "react";
import { X, Keyboard, Search, Compass, ShoppingCart } from "lucide-react";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Navegación" | "Terminal POS";
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const shortcuts: ShortcutItem[] = [
    // Navigation
    { keys: ["Alt", "D"], description: "Ir al Dashboard / Inicio", category: "Navegación" },
    { keys: ["Alt", "T"], description: "Ir a Facturar (Terminal POS)", category: "Navegación" },
    { keys: ["Alt", "I"], description: "Ir a Catálogo e Inventario", category: "Navegación" },
    { keys: ["Alt", "C"], description: "Ir a Clientes", category: "Navegación" },
    { keys: ["Alt", "R"], description: "Ir a Créditos y Cartera", category: "Navegación" },
    { keys: ["Alt", "E"], description: "Ir a Control de Gastos", category: "Navegación" },
    { keys: ["Alt", "H"], description: "Ir a Historial / Facturas Emitidas", category: "Navegación" },
    { keys: ["Alt", "V"], description: "Ir a Devoluciones (solo Cajero)", category: "Navegación" },
    { keys: ["Alt", "A"], description: "Ir a Arqueo y Cierre (solo Cajero)", category: "Navegación" },
    { keys: ["Ctrl", "/"], description: "Mostrar / Ocultar esta guía de atajos", category: "Navegación" },

    // POS actions
    { keys: ["Ctrl", "S"], description: "Enfocar buscador del catálogo / simular escáner", category: "Terminal POS" },
    { keys: ["Ctrl", "N"], description: "Nueva Factura (Limpiar carrito de compras)", category: "Terminal POS" },
    { keys: ["Alt", "O"], description: "Registro rápido y asociación de nuevo cliente", category: "Terminal POS" },
    { keys: ["Alt", "1"], description: "Seleccionar método de pago: Efectivo", category: "Terminal POS" },
    { keys: ["Alt", "2"], description: "Seleccionar método de pago: Tarjeta", category: "Terminal POS" },
    { keys: ["Alt", "3"], description: "Seleccionar método de pago: Nequi/Daviplata", category: "Terminal POS" },
    { keys: ["Alt", "4"], description: "Seleccionar método de pago: Crédito de Cartera", category: "Terminal POS" },
    { keys: ["Ctrl", "Enter"], description: "Procesar y finalizar checkout (Facturar)", category: "Terminal POS" },
  ];

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return shortcuts;
    return shortcuts.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  const navigationShortcuts = filteredShortcuts.filter((s) => s.category === "Navegación");
  const posShortcuts = filteredShortcuts.filter((s) => s.category === "Terminal POS");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Atajos de Teclado Globales</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Optimiza tus operaciones diarias y navega a velocidad de teclado.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar atajo, comando o tecla..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              autoFocus
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Shortcuts List Grid */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30 flex flex-col gap-6">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <span className="text-slate-300 dark:text-slate-600 font-black text-2xl mb-2">⌨️</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">No se encontraron atajos con tu búsqueda.</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-extrabold"
              >
                Restablecer búsqueda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Navegación Column */}
              {navigationShortcuts.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <Compass className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight uppercase">Navegación de Páginas</h4>
                  </div>
                  <div className="flex flex-col gap-2">
                    {navigationShortcuts.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-100 dark:hover:border-slate-700 transition-colors"
                      >
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{s.description}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-4">
                          {s.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              {kIdx > 0 && <span className="text-[10px] text-slate-400 font-bold">+</span>}
                              <kbd className="px-2 py-0.5 text-[10px] font-black text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xs">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Terminal POS Column */}
              {posShortcuts.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <ShoppingCart className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight uppercase">Terminal POS & Caja</h4>
                  </div>
                  <div className="flex flex-col gap-2">
                    {posShortcuts.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-emerald-100 dark:hover:border-slate-700 transition-colors"
                      >
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{s.description}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-4">
                          {s.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              {kIdx > 0 && <span className="text-[10px] text-slate-400 font-bold">+</span>}
                              <kbd className="px-1.5 py-0.5 text-[10px] font-black text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xs">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
          <span>💡 <strong className="text-slate-600 dark:text-slate-300">Tip de teclado:</strong> Los atajos que usan Ctrl o Alt previenen el comportamiento del navegador para evitar conflictos.</span>
          <span>Presiona <kbd className="px-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200">Esc</kbd> para cerrar</span>
        </div>
      </div>
    </div>
  );
};
