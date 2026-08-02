import { useEffect, useRef } from "react";

export interface ShortcutConfig {
  key: string;            // e.g., "s", "n", "Enter", "1", "d", "i", "/"
  ctrl?: boolean;         // Requires Ctrl key
  alt?: boolean;          // Requires Alt key
  shift?: boolean;        // Requires Shift key
  description: string;    // Description of the action
  category: "Navegación" | "Terminal POS";
  action: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
  allowInInputs?: boolean; // Force shortcut even if typing in input/textarea
}

export const useKeyboardShortcuts = (
  shortcuts: ShortcutConfig[],
  isActive: boolean = true
) => {
  // Use a ref to keep the list of shortcuts up to date without re-binding listeners
  const shortcutsRef = useRef<ShortcutConfig[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is inside an input field
      const target = event.target as HTMLElement | null;
      const isInputField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      for (const shortcut of shortcutsRef.current) {
        // Normalize comparison keys
        const targetKey = shortcut.key.toLowerCase();
        const eventKey = event.key.toLowerCase();

        const matchKey = eventKey === targetKey || event.code.toLowerCase() === targetKey;
        const matchCtrl = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const matchAlt = !!shortcut.alt === event.altKey;
        const matchShift = !!shortcut.shift === event.shiftKey;

        if (matchKey && matchCtrl && matchAlt && matchShift) {
          // If in input field, skip if it's a plain single key with no modifier, 
          // unless allowInInputs is explicitly true.
          const hasModifier = shortcut.ctrl || shortcut.alt;
          if (isInputField && !hasModifier && !shortcut.allowInInputs) {
            continue;
          }

          if (shortcut.preventDefault) {
            event.preventDefault();
          }

          shortcut.action(event);
          break; // Stop matching other shortcuts once one succeeds
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);
};
