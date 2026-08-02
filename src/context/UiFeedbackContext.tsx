import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  severity?: "danger" | "warning" | "info";
}

interface UiFeedbackContextType {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (options: ConfirmOptions) => void;
}

const UiFeedbackContext = createContext<UiFeedbackContextType | undefined>(undefined);

export const useUiFeedback = (): UiFeedbackContextType => {
  const context = useContext(UiFeedbackContext);
  if (!context) {
    throw new Error("useUiFeedback must be used within a UiFeedbackProvider");
  }
  return context;
};

interface UiFeedbackProviderProps {
  children: ReactNode;
}

export const UiFeedbackProvider: React.FC<UiFeedbackProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirm(options);
  }, []);

  const handleConfirm = () => {
    if (confirm) {
      confirm.onConfirm();
      setConfirm(null);
    }
  };

  const handleCancel = () => {
    if (confirm) {
      if (confirm.onCancel) confirm.onCancel();
      setConfirm(null);
    }
  };

  return (
    <UiFeedbackContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : toast.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : toast.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-sky-50 border-sky-200 text-sky-800"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-sky-600" />}
            </div>
            <div className="flex-1 text-sm font-medium pr-2">{toast.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 hover:opacity-75 transition-opacity"
            >
              <X className="w-4 h-4 opacity-50 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>

      {/* Elegant Custom Confirmation Modal Overlay */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden animate-zoom-in">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-full shrink-0 ${
                  confirm.severity === "danger"
                    ? "bg-rose-50 text-rose-600"
                    : confirm.severity === "warning"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-indigo-50 text-indigo-600"
                }`}
              >
                {confirm.severity === "danger" ? (
                  <AlertCircle className="w-6 h-6" />
                ) : confirm.severity === "warning" ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                  {confirm.title}
                </h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {confirm.message}
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                {confirm.cancelText || "Cancelar"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-all shadow-sm active:scale-95 ${
                  confirm.severity === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirm.severity === "warning"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirm.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiFeedbackContext.Provider>
  );
};
