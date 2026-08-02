import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("softwork_theme") === "dark"
      );
    }
    return false;
  });

  useEffect(() => {
    // Keep local component state in sync with actual DOM class
    const updateStateFromDom = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    
    // Observer for class mutations on html element
    const observer = new MutationObserver(updateStateFromDom);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("softwork_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("softwork_theme", "light");
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 cursor-pointer active:scale-95 ${className}`}
      title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
      aria-label="Alternar modo de color"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
};

export default ThemeToggle;
