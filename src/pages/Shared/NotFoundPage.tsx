import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../shared/constants";
import { SearchCode, ArrowLeft, Home } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (!user) {
      navigate(ROUTES.LOGIN);
    } else if (user.role === "ADMIN") {
      navigate(ROUTES.ADMIN_DASHBOARD);
    } else {
      navigate(ROUTES.WORKER_DASHBOARD);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-8 text-center flex flex-col items-center">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-5">
          <SearchCode className="w-12 h-12" />
        </div>
        
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Página No Encontrada (404)
        </h2>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          El recurso o módulo que estás intentando cargar no existe o ha sido movido a una dirección diferente.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Volver Atrás
          </button>
          
          <button
            onClick={handleGoHome}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Ir al Inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
