import { readJSON, writeJSON } from "./storage.service";
import { PERMISSIONS } from "../permissions/PermissionConstants";

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  action: "ROLE_SWITCH" | "PERMISSION_CHECK" | "INHERITANCE_VERIFY" | "SESSION_INIT" | "PERMISSIONS_UPDATED";
  permission?: string;
  result: boolean;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}

const DIAGNOSTIC_LOGS_KEY = "softwork_diagnostic_logs";

export const DEFAULT_EXPECTED_WORKER_PERMISSIONS = [
  PERMISSIONS.ACCESS_POS,
  PERMISSIONS.VIEW_INVENTORY,
  PERMISSIONS.VIEW_CLIENTS,
  PERMISSIONS.VIEW_CREDITS,
  PERMISSIONS.VIEW_EXPENSES,
  PERMISSIONS.VIEW_SALES_HISTORY,
  PERMISSIONS.CLOSE_CASH_REGISTER,
  PERMISSIONS.MANAGE_RETURNS,
] as const;

/**
 * Gets all diagnostic logs from localStorage.
 */
export const getDiagnosticLogs = (): DiagnosticLog[] => {
  return readJSON<DiagnosticLog[]>(DIAGNOSTIC_LOGS_KEY, []);
};

/**
 * Adds a new diagnostic log.
 */
export const addDiagnosticLog = (
  log: Omit<DiagnosticLog, "id" | "timestamp">
): DiagnosticLog => {
  const logs = getDiagnosticLogs();
  const newLog: DiagnosticLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
  };

  // Prepend to show latest first
  const updatedLogs = [newLog, ...logs].slice(0, 150); // limit to last 150 logs
  writeJSON(DIAGNOSTIC_LOGS_KEY, updatedLogs);

  // Dispatch custom event asynchronously to notify components/hooks without causing setState-during-render errors
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("softwork_diagnostic_update", { detail: newLog }));
  }, 0);
  
  return newLog;
};

/**
 * Clears all diagnostic logs.
 */
export const clearDiagnosticLogs = (): void => {
  writeJSON(DIAGNOSTIC_LOGS_KEY, []);
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("softwork_diagnostic_update", { detail: null }));
  }, 0);
};

/**
 * Verifies if Carlos (or any user with WORKER role) has inherited all expected default permissions.
 */
export const verifyWorkerInheritance = (
  userEmail: string,
  userName: string,
  role: string,
  userPermissions: string[]
): { inherited: string[]; missing: string[]; allCorrect: boolean } => {
  if (role === "ADMIN") {
    return {
      inherited: Object.values(PERMISSIONS),
      missing: [],
      allCorrect: true,
    };
  }

  const inherited: string[] = [];
  const missing: string[] = [];

  DEFAULT_EXPECTED_WORKER_PERMISSIONS.forEach((p) => {
    if (userPermissions.includes(p)) {
      inherited.push(p);
    } else {
      missing.push(p);
    }
  });

  const allCorrect = missing.length === 0;

  addDiagnosticLog({
    userId: userEmail,
    userName,
    role,
    action: "INHERITANCE_VERIFY",
    result: allCorrect,
    message: allCorrect
      ? `Verificación de herencia exitosa para "${userName}" (${role}). Hereda correctamente los ${inherited.length} permisos esperados de PermissionConstants.`
      : `Verificación de herencia con advertencias para "${userName}" (${role}). Hereda: [${inherited.join(", ")}]. Le faltan los siguientes permisos esperados: [${missing.join(", ")}].`,
    type: allCorrect ? "SUCCESS" : "WARNING",
  });

  return { inherited, missing, allCorrect };
};
