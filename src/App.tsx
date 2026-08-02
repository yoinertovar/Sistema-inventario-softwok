import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProviders } from "./app/providers/AppProviders";
import { syncFromServer } from "./services/storage.service";
import { Database } from "lucide-react";
import { PrivateRoute } from "./app/routes/PrivateRoute";
import { useAuth } from "./context/AuthContext";
import { ROUTES } from "./shared/constants";
import { PERMISSIONS } from "./permissions/PermissionConstants";
import { hasPermission } from "./utils/permissions";

// Layouts
import { AdminLayout } from "./shared/layout/AdminLayout";
import { WorkerLayout } from "./shared/layout/WorkerLayout";

// Shared views
import { UnauthorizedPage } from "./pages/Shared/UnauthorizedPage";
import { NotFoundPage } from "./pages/Shared/NotFoundPage";
import { LoginPage } from "./pages/Auth/LoginPage";

// Admin-specific views
import { AdminDashboardPage } from "./pages/Admin/Dashboard/AdminDashboardPage";
import { SuppliersPage } from "./pages/Admin/Suppliers/SuppliersPage";
import { PayrollPage } from "./pages/Admin/Payroll/PayrollPage";
import { UsersPage } from "./pages/Admin/Users/UsersPage";
import { AuditTrailPage } from "./pages/Admin/AuditTrail/AuditTrailPage";

// Worker-specific views
import { WorkerDashboardPage } from "./pages/Worker/Dashboard/WorkerDashboardPage";
import { SmartWorkspace } from "./pages/Worker/SmartWorkspace";
import { CashRegisterClosingPage } from "./pages/Worker/CashRegister/CashRegisterClosingPage";
import { ReturnsPage } from "./pages/Worker/Returns/ReturnsPage";

// Shared common views
import { InventoryPage } from "./pages/Shared/Inventory/InventoryPage";
import { ClientsPage } from "./pages/Shared/Clients/ClientsPage";
import { CreditsPage } from "./pages/Shared/Credits/CreditsPage";
import { ExpensesPage } from "./pages/Shared/Expenses/ExpensesPage";
import { InvoicesPage } from "./pages/Shared/Invoices/InvoicesPage";
import { HistoryPage } from "./pages/Shared/History/HistoryPage";

const ROUTE_PERMISSIONS: Record<string, string> = {
  [ROUTES.WORKSPACE]: PERMISSIONS.ACCESS_POS,
  [ROUTES.INVENTORY]: PERMISSIONS.VIEW_INVENTORY,
  [ROUTES.CLIENTS]: PERMISSIONS.VIEW_CLIENTS,
  [ROUTES.CREDITS]: PERMISSIONS.VIEW_CREDITS,
  [ROUTES.EXPENSES]: PERMISSIONS.VIEW_EXPENSES,
  [ROUTES.INVOICES]: PERMISSIONS.VIEW_SALES_HISTORY,
  [ROUTES.HISTORY]: PERMISSIONS.VIEW_SALES_HISTORY,
  [ROUTES.RETURNS]: PERMISSIONS.MANAGE_RETURNS,
  [ROUTES.CASH_REGISTER]: PERMISSIONS.CLOSE_CASH_REGISTER,
};

// Adaptive Shared Route Layout Wrapper
const SharedLayoutWrapper: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (user?.role === "ADMIN") {
    return <AdminLayout />;
  } else {
    // If worker, check path permissions
    const path = location.pathname;
    const requiredPermission = ROUTE_PERMISSIONS[path];
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
    }
    return <WorkerLayout />;
  }
};

const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Root redirect rules */}
      <Route
        path="/"
        element={
          !user ? (
            <Navigate to={ROUTES.LOGIN} replace />
          ) : user.role === "ADMIN" ? (
            <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />
          ) : (
            <Navigate to={ROUTES.WORKER_DASHBOARD} replace />
          )
        }
      />

      {/* Publicly available auth paths */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.UNAUTHORIZED} element={<UnauthorizedPage />} />

      {/* Admin exclusive routes */}
      <Route element={<PrivateRoute allowedRoles={["ADMIN"]} />}>
        <Route element={<AdminLayout />}>
          <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
          <Route path={ROUTES.SUPPLIERS} element={<SuppliersPage />} />
          <Route path={ROUTES.PAYROLL} element={<PayrollPage />} />
          <Route path={ROUTES.USERS} element={<UsersPage />} />
          <Route path={ROUTES.AUDIT_TRAIL} element={<AuditTrailPage />} />
        </Route>
      </Route>

      {/* Worker exclusive routes */}
      <Route element={<PrivateRoute allowedRoles={["WORKER"]} />}>
        <Route element={<WorkerLayout />}>
          <Route path={ROUTES.WORKER_DASHBOARD} element={<WorkerDashboardPage />} />
        </Route>
      </Route>

      {/* Shared common routes with adaptive sidebars */}
      <Route element={<PrivateRoute allowedRoles={["ADMIN", "WORKER"]} />}>
        <Route element={<SharedLayoutWrapper />}>
          <Route path={ROUTES.INVENTORY} element={<InventoryPage />} />
          <Route path={ROUTES.CLIENTS} element={<ClientsPage />} />
          <Route path={ROUTES.CREDITS} element={<CreditsPage />} />
          <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
          <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
          <Route path={ROUTES.INVOICES} element={<InvoicesPage />} />
          <Route path={ROUTES.WORKSPACE} element={<SmartWorkspace />} />
          <Route path={ROUTES.CASH_REGISTER} element={<CashRegisterClosingPage />} />
          <Route path={ROUTES.RETURNS} element={<ReturnsPage />} />
        </Route>
      </Route>

      {/* 404 Fallback page */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  const [isSyncing, setIsSyncing] = React.useState(true);

  React.useEffect(() => {
    syncFromServer().finally(() => {
      // Small timeout to give a smooth, elegant transition feel
      setTimeout(() => {
        setIsSyncing(false);
      }, 600);
    });
  }, []);

  if (isSyncing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute"></div>
          <Database className="w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-base font-bold tracking-tight mb-1 text-center">Iniciando Base de Datos</h2>
        <p className="text-slate-400 text-[11px] max-w-xs text-center leading-relaxed font-semibold">
          Sincronizando con el servidor Node.js para habilitar persistencia en tiempo real y facturación rápida...
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </BrowserRouter>
  );
};

export default App;
