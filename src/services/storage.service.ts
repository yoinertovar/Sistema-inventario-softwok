// Create a cross-tab BroadcastChannel for real-time synchronization
const syncChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("softwork_realtime_sync") : null;

/**
 * Securely reads and parses a JSON record from LocalStorage.
 */
export const readJSON = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return fallback;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading key "${key}" from localStorage:`, error);
    return fallback;
  }
};

/**
 * Writes any object or value to LocalStorage and triggers background sync and real-time broadcasts.
 */
export const writeJSON = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    
    // Dispatch local custom DOM event for instant same-window reaction
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("softwork_storage_update", { detail: { key, value } }));
    }

    // Broadcast message to other tabs/windows in real time
    if (syncChannel) {
      syncChannel.postMessage({ type: "STORAGE_UPDATE", key, value, timestamp: Date.now() });
    }

    // Background sync to the Node.js Express backend (non-blocking)
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    }).catch((err) => {
      console.warn(`Background server sync attempt for key "${key}":`, err?.message || err);
    });
  } catch (error) {
    console.error(`Error writing key "${key}" to localStorage:`, error);
  }
};

/**
 * Deletes a record from LocalStorage and synchronizes the deletion.
 */
export const removeJSON = (key: string): void => {
  try {
    localStorage.removeItem(key);
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("softwork_storage_update", { detail: { key, value: null } }));
    }

    if (syncChannel) {
      syncChannel.postMessage({ type: "STORAGE_UPDATE", key, value: null, timestamp: Date.now() });
    }

    // Background sync deletion to the Node.js Express backend (non-blocking)
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "DELETE",
    }).catch((err) => {
      console.warn(`Background server deletion sync attempt for key "${key}":`, err?.message || err);
    });
  } catch (error) {
    console.error(`Error removing key "${key}" from localStorage:`, error);
  }
};

/**
 * Listens to real-time storage updates from other tabs or local writes.
 */
export const subscribeToRealtimeStorage = (callback: (key: string, value: any) => void) => {
  if (typeof window === "undefined") return () => {};

  // Local DOM event handler
  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      callback(detail.key, detail.value);
    }
  };

  // Cross-tab BroadcastChannel handler
  const handleChannelMessage = (e: MessageEvent) => {
    if (e.data && e.data.type === "STORAGE_UPDATE") {
      // Sync local storage if received from another tab
      if (e.data.value !== null) {
        localStorage.setItem(e.data.key, JSON.stringify(e.data.value));
      } else {
        localStorage.removeItem(e.data.key);
      }
      callback(e.data.key, e.data.value);
    }
  };

  window.addEventListener("softwork_storage_update", handleCustomEvent);
  if (syncChannel) {
    syncChannel.addEventListener("message", handleChannelMessage);
  }

  return () => {
    window.removeEventListener("softwork_storage_update", handleCustomEvent);
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleChannelMessage);
    }
  };
};

/**
 * Synchronizes and loads all persistent JSON files from the Node.js server storage into LocalStorage.
 */
export const syncFromServer = async (): Promise<boolean> => {
  try {
    const res = await fetch("/api/storage");
    if (!res.ok) throw new Error("Server storage response not OK");
    const data = await res.json();
    
    // Populate localStorage with all keys stored on the Node.js server
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
    return true;
  } catch (error) {
    console.warn("Could not sync storage from Node.js server:", error);
    return false;
  }
};
