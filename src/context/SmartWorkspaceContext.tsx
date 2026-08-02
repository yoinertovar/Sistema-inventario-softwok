import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Product } from "../services/product.service";
import { Client } from "../services/client.service";
import { useUiFeedback } from "./UiFeedbackContext";

export interface WorkspaceTab {
  id: string;
  name: string;
  items: {
    productId: string;
    name: string;
    qty: number;
    price: number;
    taxRate: number;
    total: number;
  }[];
  client: Client;
  paymentMethod: "CASH" | "CARD" | "NEQUI_DAVIPLATA" | "CREDIT";
}

interface SmartWorkspaceContextType {
  tabs: WorkspaceTab[];
  workspaces: WorkspaceTab[]; // alias for WorkerDashboardPage
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  addTab: (name?: string) => void;
  removeTab: (id: string) => void;
  updateTabItems: (id: string, items: WorkspaceTab["items"]) => void;
  updateTabClient: (id: string, client: Client) => void;
  updateTabPayment: (id: string, method: WorkspaceTab["paymentMethod"]) => void;
  clearTab: (id: string) => void;
}

const SmartWorkspaceContext = createContext<SmartWorkspaceContextType | undefined>(undefined);

export const useSmartWorkspace = (): SmartWorkspaceContextType => {
  const context = useContext(SmartWorkspaceContext);
  if (!context) {
    throw new Error("useSmartWorkspace must be used within a SmartWorkspaceProvider");
  }
  return context;
};

interface SmartWorkspaceProviderProps {
  children: ReactNode;
}

const DEFAULT_CLIENT: Client = {
  id: "cli-consumidor",
  name: "Consumidor Final (Público General)",
  nitOrCc: "222222222222",
  phone: "N/A",
  email: "consumidor@softwork.co",
  address: "Ventas de Mostrador",
  creditLimit: 0,
  creditBalance: 0,
  active: true,
  createdAt: new Date().toISOString(),
};

const createNewTab = (id: string, name: string): WorkspaceTab => ({
  id,
  name,
  items: [],
  client: DEFAULT_CLIENT,
  paymentMethod: "CASH",
});

export const SmartWorkspaceProvider: React.FC<SmartWorkspaceProviderProps> = ({ children }) => {
  const { showToast } = useUiFeedback();
  
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    createNewTab("tab-1", "Venta Principal 1"),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");

  const addTab = (name?: string) => {
    if (tabs.length >= 5) {
      showToast("Límite de terminales activas alcanzado (Máx 5).", "warning");
      return;
    }
    const id = `tab-${Date.now()}`;
    const workspaceName = name || `Venta Adicional ${tabs.length + 1}`;
    setTabs((prev) => [...prev, createNewTab(id, workspaceName)]);
    setActiveTabId(id);
    showToast(`Nueva pestaña "${workspaceName}" creada.`, "info");
  };

  const removeTab = (id: string) => {
    if (tabs.length <= 1) {
      showToast("Debe mantener al menos una pestaña de facturación activa.", "warning");
      return;
    }
    
    // Determine next active workspace tab
    const index = tabs.findIndex((t) => t.id === id);
    let nextActiveId = activeTabId;
    if (activeTabId === id) {
      const nextIndex = index === 0 ? 1 : index - 1;
      nextActiveId = tabs[nextIndex].id;
    }

    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTabId(nextActiveId);
    showToast("Pestaña de venta cerrada.", "info");
  };

  const updateTabItems = (id: string, items: WorkspaceTab["items"]) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, items } : t))
    );
  };

  const updateTabClient = (id: string, client: Client) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, client } : t))
    );
  };

  const updateTabPayment = (id: string, paymentMethod: WorkspaceTab["paymentMethod"]) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, paymentMethod } : t))
    );
  };

  const clearTab = (id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, items: [], client: DEFAULT_CLIENT, paymentMethod: "CASH" } : t))
    );
  };

  return (
    <SmartWorkspaceContext.Provider
      value={{
        tabs,
        workspaces: tabs, // alias for WorkerDashboardPage
        activeTabId,
        setActiveTabId,
        addTab,
        removeTab,
        updateTabItems,
        updateTabClient,
        updateTabPayment,
        clearTab,
      }}
    >
      {children}
    </SmartWorkspaceContext.Provider>
  );
};
