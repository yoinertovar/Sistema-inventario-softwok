import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { login, logout, verifyToken, UserSession } from "../services/auth.service";
import { subscribeToRealtimeStorage } from "../services/storage.service";
import {
  DiagnosticLog,
  getDiagnosticLogs,
  addDiagnosticLog,
  clearDiagnosticLogs,
  verifyWorkerInheritance,
} from "../services/diagnostic.service";

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  loginUser: (email: string, password: string) => Promise<UserSession>;
  logoutUser: () => void;
  refreshSession: () => Promise<void>;
  diagnosticLogs: DiagnosticLog[];
  clearLogs: () => void;
  runInheritanceVerify: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);

  // Helper to refresh logs state from disk
  const syncLogsState = () => {
    setDiagnosticLogs(getDiagnosticLogs());
  };

  useEffect(() => {
    // Initial sync
    syncLogsState();

    // Listen to diagnostic updates
    const handleDiagnosticUpdate = () => {
      syncLogsState();
    };
    window.addEventListener("softwork_diagnostic_update", handleDiagnosticUpdate);

    // Subscribe to cross-tab and in-window real-time storage events.
    // IMPORTANT: Only listen to "softwork_users" changes (admin editing users).
    // Do NOT listen to "softwork_current_user" here — refreshSession() writes to it,
    // which would trigger this listener again, creating an infinite loop.
    const unsubscribeRealtime = subscribeToRealtimeStorage((key) => {
      if (key === "softwork_users") {
        refreshSession();
      }
    });

    // Periodically run token verification as a safety fallback (every 30s is sufficient)
    const intervalId = setInterval(() => {
      if (localStorage.getItem("softwork_current_user")) {
        refreshSession();
      }
    }, 30000);

    // Also listen to browser storage events directly for cross-tab sync.
    // Only react to user database changes, not session changes.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "softwork_users") {
        refreshSession();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("softwork_diagnostic_update", handleDiagnosticUpdate);
      window.removeEventListener("storage", handleStorageChange);
      unsubscribeRealtime();
      clearInterval(intervalId);
    };
  }, []);

  const runInheritanceVerify = () => {
    if (user) {
      verifyWorkerInheritance(user.email, user.name, user.role, user.permissions || []);
    }
  };

  // Run inheritance verification whenever the user session changes
  useEffect(() => {
    if (user) {
      // Log session initialized/switched
      addDiagnosticLog({
        userId: user.email,
        userName: user.name,
        role: user.role,
        action: "SESSION_INIT",
        result: true,
        message: `Sesión activa establecida para "${user.name}" con el rol de ${user.role === "ADMIN" ? "Administrador" : "Cajero Operador"}.`,
        type: "INFO",
      });

      // Verify default inheritance
      verifyWorkerInheritance(user.email, user.name, user.role, user.permissions || []);
    }
  }, [user?.id, user?.role]);

  const prevPermissionsRef = useRef<string>("");
  useEffect(() => {
    // If user's specific permissions changed, log it and run verification
    const currentPerms = JSON.stringify(user?.permissions || []);
    if (user && prevPermissionsRef.current && prevPermissionsRef.current !== currentPerms) {
      addDiagnosticLog({
        userId: user.email,
        userName: user.name,
        role: user.role,
        action: "PERMISSIONS_UPDATED",
        result: true,
        message: `La matriz de permisos para "${user.name}" se actualizó. Ahora cuenta con ${user.permissions?.length || 0} permisos asignados en tiempo real.`,
        type: "INFO",
      });
    }
    prevPermissionsRef.current = currentPerms;
  }, [user?.permissions]);

  const initializeAuth = async () => {
    try {
      const session = await verifyToken();
      setUser(session);
    } catch (err) {
      console.error("Failed to restore auth session:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeAuth();
  }, []);

  const loginUser = async (email: string, password: string): Promise<UserSession> => {
    setLoading(true);
    try {
      const session = await login(email, password);

      addDiagnosticLog({
        userId: session.email,
        userName: session.name,
        role: session.role,
        action: "ROLE_SWITCH",
        result: true,
        message: `Inicio de sesión exitoso. Cambio de rol activo a ${session.role === "ADMIN" ? "ADMINISTRADOR" : "TRABAJADOR/CAJERO"} para "${session.name}".`,
        type: "SUCCESS",
      });

      setUser(session);
      return session;
    } catch (error: any) {
      setUser(null);
      addDiagnosticLog({
        userId: email,
        userName: "Intento Fallido",
        role: "N/A",
        action: "ROLE_SWITCH",
        result: false,
        message: `Intento de inicio de sesión fallido para ${email}. Error: ${error?.message || "Credenciales incorrectas"}`,
        type: "ERROR",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = () => {
    if (user) {
      addDiagnosticLog({
        userId: user.email,
        userName: user.name,
        role: user.role,
        action: "ROLE_SWITCH",
        result: true,
        message: `Cierre de sesión. Se abandonó el rol de ${user.role} de forma segura para "${user.name}".`,
        type: "INFO",
      });
    }
    logout();
    setUser(null);
  };

  const refreshSession = async () => {
    try {
      const session = await verifyToken();

      setUser((currentUser) => {
        // Only update user state if there is a real difference in values
        if (JSON.stringify(session) !== JSON.stringify(currentUser)) {
          return session;
        }
        return currentUser;
      });
    } catch (err) {
      console.error("Failed to refresh session:", err);
    }
  };

  const clearLogs = () => {
    clearDiagnosticLogs();
    syncLogsState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginUser,
        logoutUser,
        refreshSession,
        diagnosticLogs,
        clearLogs,
        runInheritanceVerify,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

