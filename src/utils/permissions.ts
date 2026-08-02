import { ROLES, UserRole } from "../shared/constants";
import { addDiagnosticLog } from "../services/diagnostic.service";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  active?: boolean;
}

// Simple in-memory cache to throttle duplicate logs for identical checks
const recentLogsCache = new Map<string, { result: boolean; timestamp: number }>();

/**
 * Checks if a user has a specific granular permission.
 * Admins automatically pass all checks.
 */
export const hasPermission = (user: UserSession | null | undefined, permission: string): boolean => {
  if (!user) {
    return false;
  }
  
  let result = false;
  let reason = "";

  if (user.role === ROLES.ADMIN) {
    result = true;
    reason = "Usuario es Administrador (Acceso total incondicional).";
  } else {
    result = user.permissions?.includes(permission) || false;
    reason = result 
      ? `Permiso concedido en la matriz de acceso.` 
      : `Permiso denegado. No está asignado en su matriz de acceso.`;
  }

  // Throttled logging to avoid React render spam (once per 5s per permission per user unless state changes)
  const cacheKey = `${user.id}:${permission}`;
  const now = Date.now();
  const cached = recentLogsCache.get(cacheKey);

  if (!cached || cached.result !== result || now - cached.timestamp > 5000) {
    recentLogsCache.set(cacheKey, { result, timestamp: now });
    
    // Write to diagnostic log asynchronously to prevent updating AuthProvider state during React render phase
    setTimeout(() => {
      addDiagnosticLog({
        userId: user.email,
        userName: user.name,
        role: user.role,
        action: "PERMISSION_CHECK",
        permission,
        result,
        message: `Validación de permiso '${permission}' para "${user.name}": ${result ? "CONCEDIDO" : "DENEGADO"}. Motivo: ${reason}`,
        type: result ? "SUCCESS" : "WARNING",
      });
    }, 0);
  }

  return result;
};

/**
 * Checks if a user has all of the specified permissions.
 */
export const hasAllPermissions = (user: UserSession | null | undefined, permissions: string[]): boolean => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  
  return permissions.every((p) => hasPermission(user, p));
};

/**
 * Checks if a user has at least one of the specified permissions.
 */
export const hasAnyPermission = (user: UserSession | null | undefined, permissions: string[]): boolean => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  
  return permissions.some((p) => hasPermission(user, p));
};

