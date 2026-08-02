import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUiFeedback } from "../../context/UiFeedbackContext";
import { ROUTES, ROLES } from "../../shared/constants";
import { Eye, EyeOff, ShieldAlert, Loader2, Sparkles, ShieldCheck, Zap, BarChart3, Users } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { loginUser } = useAuth();
  const { showToast } = useUiFeedback();
  const navigate = useNavigate();

  // Local state for credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const session = await loginUser(email, password);
      showToast(`¡Bienvenido de nuevo, ${session.name}!`, "success");
      
      // Route based on user role
      if (session.role === ROLES.ADMIN) {
        navigate(ROUTES.ADMIN_DASHBOARD);
      } else {
        navigate(ROUTES.WORKER_DASHBOARD);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al iniciar sesión.");
      showToast(err.message || "Error de autenticación.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: "admin" | "cajero") => {
    if (role === "admin") {
      setEmail("admin@softwork.co");
      setPassword("admin");
    } else {
      setEmail("cajero@softwork.co");
      setPassword("cajero");
    }
    showToast(`Credenciales cargadas. Haz clic en "Iniciar Sesión"`, "info");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* BRANDING LEFT COLUMN - HIDDEN ON MOBILE */}
      <div className="hidden md:flex md:w-1/2 bg-slate-950 p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Decorative Grid Overlays */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-indigo-600/30">
              SW
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              SoftWork Solutions
            </span>
          </div>
        </div>

        {/* Center Marketing Block */}
        <div className="relative z-10 my-auto max-w-md">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-indigo-400 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Versión Empresarial v1.0.0
          </div>
          
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
            Administración de Inventario y Terminal POS Profesional
          </h2>
          <p className="mt-4 text-slate-400 leading-relaxed text-sm">
            Optimiza los flujos de facturación, calcula comisiones por ventas de forma automatizada, gestiona créditos a clientes y mantén el control total del stock en tiempo real.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Control de Permisos Avanzado</h4>
                <p className="text-xs text-slate-400 mt-0.5">Asigna permisos modulares específicos a cada empleado de caja.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-indigo-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Caja Multi-Pestaña Integrada</h4>
                <p className="text-xs text-slate-400 mt-0.5">Atiende múltiples ventas paralelas sin perder el hilo de las cuentas.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-amber-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Estadísticas y Conciliación Financiera</h4>
                <p className="text-xs text-slate-400 mt-0.5">Registros de arqueo e ingresos versus egresos consolidados.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex justify-between items-center">
          <span>© 2026 SoftWork Solutions S.A.S.</span>
          <span>Bogotá, Colombia</span>
        </div>
      </div>

      {/* LOGIN CARD COLUMN */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-12 lg:px-24 bg-white">
        <div className="mx-auto w-full max-w-md">
          {/* Logo on mobile only */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold">
              SW
            </div>
            <span className="font-bold text-slate-900">SoftWork Solutions</span>
          </div>

          <h3 className="text-2xl font-bold text-slate-950 tracking-tight">
            Acceso al Sistema
          </h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Bienvenido. Ingrese sus credenciales para iniciar su turno de trabajo.
          </p>

          {/* Validation Warning Alert */}
          {errorMsg && (
            <div className="mt-6 flex gap-3 p-3.5 rounded-xl border border-rose-100 bg-rose-50 text-rose-800 text-xs leading-relaxed animate-slide-in">
              <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@softwork.co"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 block">Contraseña</label>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                >
                  {showPwd ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold text-sm py-2.5 rounded-xl mt-2 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/15 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Verificando Acceso...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>

          {/* Quick Demodemo accounts for developers testing the preview */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-3">
              Acceso Rápido de Prueba (Demo)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin")}
                className="flex flex-col items-start p-3 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 text-left transition-all"
              >
                <span className="text-xs font-bold text-indigo-700">Administrador</span>
                <span className="text-[10px] text-slate-500 mt-1">Usuario: admin</span>
                <span className="text-[10px] text-slate-400">Contraseña: admin</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleQuickLogin("cajero")}
                className="flex flex-col items-start p-3 border border-slate-100 rounded-xl hover:border-emerald-100 hover:bg-emerald-50/20 text-left transition-all"
              >
                <span className="text-xs font-bold text-emerald-700">Cajero / Vendedor</span>
                <span className="text-[10px] text-slate-500 mt-1">Usuario: cajero</span>
                <span className="text-[10px] text-slate-400">Contraseña: cajero</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
