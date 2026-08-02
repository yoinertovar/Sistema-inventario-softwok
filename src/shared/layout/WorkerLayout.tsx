import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUiFeedback } from "../../context/UiFeedbackContext";
import { ROUTES } from "../constants";
import { getProducts } from "../../services/product.service";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  CreditCard,
  DollarSign,
  History,
  Scale,
  Coins,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  Shield,
  Check,
  Save,
  Lock,
  ChevronDown,
  RotateCcw,
  Wallet,
  Keyboard,
  Package,
  Sun,
  Moon
} from "lucide-react";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { ShortcutsHelpModal } from "../../components/ShortcutsHelpModal";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PERMISSIONS } from "../../permissions/PermissionConstants";
import { hasPermission } from "../../utils/permissions";

export const WorkerLayout: React.FC = () => {
  const { user, logoutUser } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile Drawer State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Theme Toggle state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("softwork_theme");
    return (saved as "light" | "dark") || "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("softwork_theme", theme);
  }, [theme]);

  // Global Keyboard Shortcuts
  useKeyboardShortcuts([
    {
      key: "/",
      ctrl: true,
      description: "Mostrar / Ocultar guía de atajos",
      category: "Navegación",
      preventDefault: true,
      action: () => setShortcutsModalOpen((prev) => !prev),
    },
    {
      key: "d",
      alt: true,
      description: "Ir al Dashboard",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.WORKER_DASHBOARD),
    },
    {
      key: "t",
      alt: true,
      description: "Ir a Facturar (Terminal POS)",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.WORKSPACE),
    },
    {
      key: "c",
      alt: true,
      description: "Ir a Clientes",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.CLIENTS),
    },
    {
      key: "r",
      alt: true,
      description: "Ir a Créditos",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.CREDITS),
    },
    {
      key: "e",
      alt: true,
      description: "Ir a Gastos",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.EXPENSES),
    },
    {
      key: "h",
      alt: true,
      description: "Ir a Facturas Emitidas",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.INVOICES),
    },
    {
      key: "v",
      alt: true,
      description: "Ir a Devoluciones",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.RETURNS),
    },
    {
      key: "a",
      alt: true,
      description: "Ir a Arqueo y Cierre",
      category: "Navegación",
      preventDefault: true,
      action: () => navigate(ROUTES.CASH_REGISTER),
    },
  ]);

  // Profile Modal state
  const [profileOpen, setProfileOpen] = useState(false);

  // Low stock alerts
  const [notifications, setNotifications] = useState<{ id: string; text: string; subtext: string; date: string }[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const [pwdState, setPwdState] = useState({ current: "", newPassword: "", confirm: "" });

  useEffect(() => {
    const products = getProducts();
    const lowStockItems = products.filter((p) => p.active && p.stock <= p.minStock);
    const alerts = lowStockItems.map((p, idx) => ({
      id: `alert-${idx}`,
      text: `Alerta: Stock Bajo`,
      subtext: `Quedan ${p.stock} u. de "${p.name}".`,
      date: "Acción requerida",
    }));
    setNotifications(alerts);
  }, [location.pathname]);

  const handleSignOut = () => {
    showConfirm({
      title: "Cerrar Sesión",
      message: "¿Está seguro de que desea salir del terminal de caja?",
      confirmText: "Salir",
      cancelText: "Permanecer",
      severity: "warning",
      onConfirm: () => {
        logoutUser();
        showToast("Sesión de caja cerrada correctamente.", "info");
        navigate(ROUTES.LOGIN);
      },
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdState.newPassword !== pwdState.confirm) {
      showToast("La confirmación de contraseña no coincide.", "error");
      return;
    }
    
    const users = JSON.parse(localStorage.getItem("softwork_users") || "[]");
    const updatedUsers = users.map((u: any) => {
      if (u.id === user?.id) {
        return { ...u, password: pwdState.newPassword };
      }
      return u;
    });
    localStorage.setItem("softwork_users", JSON.stringify(updatedUsers));
    
    showToast("Contraseña actualizada con éxito.", "success");
    setPwdState({ current: "", newPassword: "", confirm: "" });
    setProfileOpen(false);
  };

  // Nav menus for cashiers with corresponding permissions
  const navItems = [
    { label: "Dashboard", path: ROUTES.WORKER_DASHBOARD, icon: LayoutDashboard },
    { label: "Facturar (Terminal POS)", path: ROUTES.WORKSPACE, icon: ShoppingCart, permission: PERMISSIONS.ACCESS_POS },
    { label: "Catálogo e Inventario", path: ROUTES.INVENTORY, icon: Package, permission: PERMISSIONS.VIEW_INVENTORY },
    { label: "Clientes", path: ROUTES.CLIENTS, icon: Users, permission: PERMISSIONS.VIEW_CLIENTS },
    { label: "Créditos", path: ROUTES.CREDITS, icon: CreditCard, permission: PERMISSIONS.VIEW_CREDITS },
    { label: "Gastos", path: ROUTES.EXPENSES, icon: DollarSign, permission: PERMISSIONS.VIEW_EXPENSES },
    { label: "Facturas Emitidas", path: ROUTES.INVOICES, icon: History, permission: PERMISSIONS.VIEW_SALES_HISTORY },
    { label: "Devoluciones", path: ROUTES.RETURNS, icon: RotateCcw, permission: PERMISSIONS.MANAGE_RETURNS },
    { label: "Arqueo y Cierre", path: ROUTES.CASH_REGISTER, icon: Wallet, permission: PERMISSIONS.CLOSE_CASH_REGISTER },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(user, item.permission)
  );

  const getBreadcrumbLabel = () => {
    const activeItem = navItems.find((item) => location.pathname === item.path);
    return activeItem ? activeItem.label : "Terminal Caja";
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 z-40 transform transition-transform duration-300 lg:translate-x-0 lg:relative lg:h-full lg:shrink-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            {/* Sidebar Branding Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-emerald-600/30 tracking-tight">
                  SW
                </div>
                <div>
                  <h1 className="text-sm font-bold text-white leading-tight">SoftWork POS</h1>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                    Terminal Cajero
                  </span>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Navigation */}
            <nav className="p-4 flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-160px)]">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                        : "hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Account section */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/20">
            <div className="flex items-center gap-3 px-2 py-1.5 mb-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                {user?.name.charAt(0).toUpperCase() || "C"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Caja
            </button>
          </div>
        </aside>

        {/* MAIN BODY CONTAINER */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* HEADER */}
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30 shadow-xs backdrop-blur-md transition-colors duration-200 shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
                  Caja General
                </span>
                <span className="text-xs text-slate-300 dark:text-slate-700">/</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{getBreadcrumbLabel()}</span>
              </div>
            </div>

            {/* Header Right Utilities */}
            <div className="flex items-center gap-4">
              {/* Notifications bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 relative"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {notifOpen && (
                  <>
                    <div onClick={() => setNotifOpen(false)} className="fixed inset-0 z-40" />
                    <div className="absolute right-0 mt-2.5 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl rounded-2xl p-4 z-50 animate-slide-in">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-50 dark:border-slate-800 mb-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Alertas de Inventario
                        </h4>
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                          {notifications.length} Stock Bajo
                        </span>
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                            Todo el catálogo cuenta con existencias estables.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div key={n.id} className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-50 dark:border-slate-800 flex gap-2">
                              <Shield className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{n.text}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{n.subtext}</p>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">{n.date}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Keyboard Shortcuts Help button */}
              <button
                onClick={() => setShortcutsModalOpen(true)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 relative"
                title="Atajos de Teclado (Ctrl+/)"
              >
                <Keyboard className="w-5 h-5" />
              </button>

              {/* Theme Toggle Button */}
              <ThemeToggle />

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />

              {/* User Dropdown Menu */}
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-600/10">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">
                    {user?.role}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
              </button>
            </div>
          </header>

          {/* PAGE INNER VIEW */}
          <main className="flex-1 p-6 w-full mx-auto overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* PROFILE MODAL (PASSWORD MODIFICATION) */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Cambiar Contraseña del Cajero
              </h3>
              <button onClick={() => setProfileOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  disabled
                  value={user?.name || ""}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Correo de Acceso</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none"
                />
              </div>
              
              <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-1" />
              
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={pwdState.newPassword}
                    onChange={(e) => setPwdState({ ...pwdState, newPassword: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Escriba nueva contraseña"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Repetir Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={pwdState.confirm}
                    onChange={(e) => setPwdState({ ...pwdState, confirm: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Confirme su nueva contraseña"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 font-semibold"
                >
                  <Save className="w-4 h-4" /> Guardar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      <ShortcutsHelpModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
};

export default WorkerLayout;
