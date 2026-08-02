import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../shared/constants";
import { Loader2 } from "lucide-react";

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="mt-4 text-sm font-medium text-slate-500 tracking-wide animate-pulse">
          Validando credenciales...
        </p>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the original path
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to unauthorized page
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PrivateRoute;
