import React, { useState, useMemo, useEffect } from "react";
import { useUiFeedback } from "../../../context/UiFeedbackContext";
import { useAuth } from "../../../context/AuthContext";
import { getUsers, saveUsers, User } from "../../../services/user.service";
import { PERMISSIONS, PERMISSION_CATEGORIES } from "../../../permissions/PermissionConstants";
import { DEFAULT_EXPECTED_WORKER_PERMISSIONS } from "../../../services/diagnostic.service";
import {
  UserCheck,
  Plus,
  Search,
  Trash2,
  Edit2,
  ShieldAlert,
  UserPlus,
  Key,
  Shield,
  X,
  Lock,
  Unlock,
  Check,
  ChevronRight,
  Phone,
  Terminal,
  Activity,
  Trash,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export const UsersPage: React.FC = () => {
  const { user: currentUser, diagnosticLogs, clearLogs, runInheritanceVerify } = useAuth();
  const { showToast, showConfirm } = useUiFeedback();

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");

  // Details Matrix panel
  const [activeMatrixUser, setActiveMatrixUser] = useState<User | null>(null);

  // User details Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [activeFormUser, setActiveFormUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    role: "WORKER" as User["role"],
    permissions: [] as string[],
    active: true,
    phone: "",
    baseSalary: 1300000,
    commissionRate: 2,
  });

  const loadData = () => {
    setUsers(getUsers());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const openUserModal = (user: User | null = null) => {
    if (user) {
      setActiveFormUser(user);
      setUserForm({
        id: user.id,
        name: user.name,
        email: user.email,
        password: "", // do not expose original hash password
        role: user.role,
        permissions: user.permissions,
        active: user.active,
        phone: user.phone || "",
        baseSalary: user.baseSalary || 1300000,
        commissionRate: user.commissionRate || 2,
      });
    } else {
      setActiveFormUser(null);
      setUserForm({
        id: "",
        name: "",
        email: "",
        password: "",
        role: "WORKER",
        permissions: [
          PERMISSIONS.VIEW_INVENTORY,
          PERMISSIONS.VIEW_CLIENTS,
          PERMISSIONS.CREATE_CLIENT,
          PERMISSIONS.ACCESS_POS,
        ], // default safe initial worker permissions
        active: true,
        phone: "",
        baseSalary: 1300000,
        commissionRate: 2,
      });
    }
    setUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim()) {
      showToast("Por favor escriba el nombre completo.", "error");
      return;
    }
    if (!userForm.email.trim()) {
      showToast("Por favor escriba el correo electrónico.", "error");
      return;
    }

    const storedUsers = getUsers();

    // Check email duplicates
    const duplicate = storedUsers.find(
      (u) => u.email.toLowerCase() === userForm.email.toLowerCase() && u.id !== userForm.id
    );
    if (duplicate) {
      showToast("Este correo electrónico ya está asignado a otra cuenta.", "warning");
      return;
    }

    if (activeFormUser) {
      // Modifying
      const idx = storedUsers.findIndex((u) => u.id === activeFormUser.id);
      if (idx >= 0) {
        const originalUser = storedUsers[idx];
        storedUsers[idx] = {
          ...originalUser,
          ...userForm,
          // Keep old password if blank
          password: userForm.password.trim() ? userForm.password : originalUser.password,
          createdAt: originalUser.createdAt || new Date().toISOString(),
        };
      }
    } else {
      // Adding new
      if (!userForm.password.trim()) {
        showToast("Por favor asigne una contraseña inicial para la nueva cuenta.", "error");
        return;
      }
      const newUser: User = {
        ...userForm,
        id: `usr-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      storedUsers.push(newUser);
    }

    saveUsers(storedUsers);
    showToast(
      `Usuario "${userForm.name}" guardado correctamente.`,
      "success"
    );
    setUserModalOpen(false);
    loadData();

    // Refresh active matrix details if visible
    if (activeMatrixUser?.id === userForm.id) {
      const refreshed = storedUsers.find((u) => u.id === userForm.id);
      setActiveMatrixUser(refreshed || null);
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      showToast("No se puede eliminar la cuenta con la que ha iniciado sesión activa.", "error");
      return;
    }

    if (user.id === "usr-admin") {
      showToast("La cuenta de superadministrador original del sistema no se puede eliminar.", "error");
      return;
    }

    showConfirm({
      title: "Eliminar Usuario",
      message: `¿Está seguro de que desea eliminar permanentemente la cuenta de "${user.name}"? Perderá acceso inmediato al panel comercial.`,
      confirmText: "Eliminar Cuenta",
      severity: "danger",
      onConfirm: () => {
        const storedUsers = getUsers();
        const filtered = storedUsers.filter((u) => u.id !== user.id);
        saveUsers(filtered);
        
        showToast("Cuenta de usuario eliminada correctamente.", "success");
        if (activeMatrixUser?.id === user.id) {
          setActiveMatrixUser(null);
        }
        loadData();
      },
    });
  };

  // Toggle permission checks directly on active matrix user
  const handleTogglePermission = (permissionKey: string) => {
    if (!activeMatrixUser) return;
    if (activeMatrixUser.id === "usr-admin") {
      showToast("La cuenta del administrador posee control absoluto inmutable.", "warning");
      return;
    }

    const updatedPermissions = activeMatrixUser.permissions.includes(permissionKey)
      ? activeMatrixUser.permissions.filter((p) => p !== permissionKey)
      : [...activeMatrixUser.permissions, permissionKey];

    const storedUsers = getUsers();
    const updated = storedUsers.map((u) => {
      if (u.id === activeMatrixUser.id) {
        u.permissions = updatedPermissions;
      }
      return u;
    });
    saveUsers(updated);

    setActiveMatrixUser({
      ...activeMatrixUser,
      permissions: updatedPermissions,
    });
    setUsers(updated);
    showToast("Permisos actualizados en tiempo real para esta cuenta.", "success");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5.5 h-5.5 text-indigo-600" /> Administración de Usuarios y Permisos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestione las cuentas de acceso de cajeros, administradores y personal de auditoría. Defina permisos de acceso granulares.
          </p>
        </div>

        <button
          onClick={() => openUserModal(null)}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" /> Registrar Usuario
        </button>
      </div>

      {/* SPLIT SCREEN MAPS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: users roster list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs">
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                placeholder="Buscar por nombre, correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                    <th className="py-3 px-6">Identificador Acceso</th>
                    <th className="py-3 px-6">Nombre Completo</th>
                    <th className="py-3 px-6">Nivel Rol</th>
                    <th className="py-3 px-6 text-center">Permisos Asignados</th>
                    <th className="py-3 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isSelected = activeMatrixUser?.id === u.id;
                    const isAdmin = u.role === "ADMIN";

                    return (
                      <tr
                        key={u.id}
                        onClick={() => setActiveMatrixUser(u)}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50/20 hover:bg-indigo-50/30" : ""
                        }`}
                      >
                        <td className="py-4 px-6 font-bold text-slate-900 font-mono">{u.email}</td>
                        <td className="py-4 px-6">
                          <p className="font-semibold text-slate-800 leading-tight">{u.name}</p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{u.phone || "Sin Celular"}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                              isAdmin
                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                : "bg-indigo-50 text-indigo-700 border-indigo-100"
                            }`}
                          >
                            {isAdmin ? "Super Admin" : "Cajero Operador"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center text-slate-500 font-bold">
                          {isAdmin ? "Acceso Total" : `${u.permissions.length} módulos`}
                        </td>
                        <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openUserModal(u)}
                              className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-slate-400 transition-all"
                              title="Editar Perfil"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={u.id === currentUser?.id || u.id === "usr-admin"}
                              className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Eliminar Cuenta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: active user permission matrix detail panel */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-6 flex flex-col gap-4">
          {!activeMatrixUser ? (
            <div className="text-center py-16 text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-xs font-semibold">Seleccione un usuario</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                Haga clic sobre un registro de la izquierda para ver y ajustar su matriz granular de permisos de seguridad comercial.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    Matriz de Permisos: {activeMatrixUser.name}
                  </h4>
                  <span className="text-[10px] text-indigo-600 font-bold mt-1 block">
                    Rol asignado: {activeMatrixUser.role}
                  </span>
                </div>
                <button
                  onClick={() => setActiveMatrixUser(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {activeMatrixUser.id === "usr-admin" ? (
                <div className="flex gap-2.5 p-4 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-800 leading-relaxed">
                  <Shield className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    La cuenta de <strong>Administrador Principal</strong> tiene acceso total e inmutable en todos los módulos del software y no se puede restringir.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                  {Object.keys(PERMISSION_CATEGORIES).map((catName) => {
                    const keys = PERMISSION_CATEGORIES[catName as keyof typeof PERMISSION_CATEGORIES];

                    return (
                      <div key={catName} className="flex flex-col gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          {keys.label}
                        </span>

                        <div className="flex flex-col gap-1.5 pl-1">
                          {keys.permissions.map((pNode) => {
                            const isGranted = activeMatrixUser.permissions.includes(pNode.id);

                            return (
                              <label
                                key={pNode.id}
                                className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-all bg-slate-50/50"
                              >
                                <span className="text-[11px] text-slate-700 font-medium">
                                  {pNode.label}
                                </span>
                                
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  onChange={() => handleTogglePermission(pNode.id)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* USER PROFILE MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-1.5">
                <Lock className="w-5 h-5 text-indigo-600" />
                {activeFormUser ? "Modificar Ficha de Acceso" : "Nuevo Registro de Acceso"}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ej. Andrés Martínez"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Correo Electrónico (Login) *</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="andres@softwork.co"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Celular / Teléfono</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="3001234567"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Perfil Operativo</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User["role"] })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-semibold text-slate-800"
                  >
                    <option value="WORKER">Cajero Operador</option>
                    <option value="ADMIN">Super Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Contraseña de Acceso {activeFormUser && "(Dejar en blanco para conservar actual)"}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required={!activeFormUser}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="Escriba clave segura"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold transition-all"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONSOLA DE DIAGNÓSTICO DE SEGURIDAD Y HERENCIA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mt-6 text-slate-100">
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Terminal className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Consola de Diagnóstico de Seguridad (Real-time Audit Logs)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Rastreo interactivo de herencia de roles y validaciones de permisos granulares para evitar inconsistencias en el POS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                runInheritanceVerify();
                showToast("Verificación de herencia ejecutada en tiempo real.", "success");
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Volver a analizar todos los permisos"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Analizar Herencia
            </button>
            <button
              onClick={() => {
                clearLogs();
                showToast("Historial de auditoría limpio.", "info");
              }}
              className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 text-[10px] text-rose-300 font-bold rounded-lg border border-rose-900/30 transition-colors flex items-center gap-1.5"
            >
              <Trash className="w-3.5 h-3.5 text-rose-400" /> Limpiar Historial
            </button>
          </div>
        </div>

        {/* Diagnostic Panel Content */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* CARLOS & WORKER INHERITANCE VERIFICATION CARD */}
          <div className="lg:col-span-1 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4.5 flex flex-col gap-3.5">
            <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" /> Auditoría: Carlos (Cajero)
            </h4>

            {(() => {
              const carlosUser = users.find((u) => u.id === "usr-cajero");
              if (!carlosUser) {
                return (
                  <div className="text-[11px] text-amber-300 bg-amber-950/20 border border-amber-900/30 p-3 rounded-lg">
                    No se encontró al usuario Carlos Cajero en la base de datos local para verificar herencia.
                  </div>
                );
              }

              // Evaluate expected default worker permissions
              const hasAll = DEFAULT_EXPECTED_WORKER_PERMISSIONS.every((p) =>
                carlosUser.permissions.includes(p)
              );
              const totalExpected = DEFAULT_EXPECTED_WORKER_PERMISSIONS.length;
              const inheritedCount = DEFAULT_EXPECTED_WORKER_PERMISSIONS.filter((p) =>
                carlosUser.permissions.includes(p)
              ).length;

              return (
                <div className="flex flex-col gap-3">
                  <div className={`p-3 rounded-xl border flex gap-3 ${
                    hasAll 
                      ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-100" 
                      : "bg-amber-950/20 border-amber-900/30 text-amber-100"
                  }`}>
                    {hasAll ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold">
                        {hasAll ? "Herencia Correcta y Completa" : "Herencia Parcial"}
                      </p>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        Carlos posee <strong>{inheritedCount} de {totalExpected}</strong> permisos esperados de la plantilla estándar definida en <code>PermissionConstants</code>.
                      </p>
                    </div>
                  </div>

                  {/* List of inherited vs missing */}
                  <div className="flex flex-col gap-1.5 text-[10px]">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-1 block">
                      Desglose de Permisos de Carlos
                    </span>
                    <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-1 font-mono">
                      {DEFAULT_EXPECTED_WORKER_PERMISSIONS.map((p) => {
                        const isGranted = carlosUser.permissions.includes(p);
                        return (
                          <div
                            key={p}
                            className={`flex items-center justify-between px-2 py-1 rounded-md border ${
                              isGranted 
                                ? "bg-slate-900/60 border-slate-800/40 text-emerald-300" 
                                : "bg-rose-950/10 border-rose-900/20 text-rose-300"
                            }`}
                          >
                            <span className="truncate">{p}</span>
                            <span className="text-[9px] font-extrabold uppercase">
                              {isGranted ? "✓ Heredado" : "✗ Faltante"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* REAL TIME LOGS FEED LIST */}
          <div className="lg:col-span-2 flex flex-col gap-3 bg-slate-950/20 border border-slate-800/80 rounded-xl p-4.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Auditoría en Tiempo Real ({diagnosticLogs.length} registros)
              </h4>
              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                ● ESCUCHANDO CAMBIOS
              </span>
            </div>

            {diagnosticLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                <Terminal className="w-6 h-6 text-slate-600 mb-2" />
                <p className="text-xs font-semibold">No hay registros de diagnóstico de seguridad en esta sesión</p>
                <p className="text-[10px] text-slate-500 mt-1">Realice transacciones, navegue, o cambie de rol para poblar la consola</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1 font-mono text-[10.5px]">
                {diagnosticLogs.map((log) => {
                  let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                  if (log.type === "SUCCESS") badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                  if (log.type === "WARNING") badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                  if (log.type === "ERROR") badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                  if (log.type === "INFO") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";

                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-950/80 border border-slate-800/50 rounded-lg flex flex-col gap-1.5 transition-colors hover:border-slate-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-1.5">
                        <span className="text-[9px] text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        
                        <div className="flex gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border uppercase ${badgeColor}`}>
                            {log.type}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[8px] text-slate-400 uppercase">
                            {log.action}
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-200 leading-relaxed font-medium">
                        {log.message}
                      </p>

                      <div className="flex gap-2.5 text-[9px] text-slate-400 mt-0.5">
                        <span>Operario: <strong className="text-slate-300">{log.userName} ({log.role})</strong></span>
                        {log.permission && (
                          <span>| Permiso verificado: <strong className="text-indigo-400">{log.permission}</strong></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
