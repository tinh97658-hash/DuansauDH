import React, { createContext, useContext, useLayoutEffect, useState } from "react";

export const FONT_SIZE_KEY = "sdh.appearance.font-size";
export const FONT_SIZE_OPTIONS = [
  { value: 90, label: "Nhỏ (90%)" },
  { value: 100, label: "Mặc định (100%)" },
  { value: 110, label: "Lớn (110%)" },
  { value: 120, label: "Rất lớn (120%)" },
  { value: 130, label: "130%" },
  { value: 140, label: "140%" },
  { value: 150, label: "150%" },
];
export const normalizeFontSize = value => FONT_SIZE_OPTIONS.some(option => option.value === Number(value)) ? Number(value) : 100;
const AppearanceContext = createContext(null);

function readFontSize() {
  try { return normalizeFontSize(localStorage.getItem(FONT_SIZE_KEY)); }
  catch { return 100; }
}

export function AppearanceSettingsProvider({ children }) {
  const [fontSize, setFontSizeState] = useState(readFontSize);
  const [storageError, setStorageError] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = String(fontSize);
    root.style.setProperty("--app-text-scale", String(fontSize / 100));
    // Menus/popovers recalculate against the control's real bounds.
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(frame);
  }, [fontSize]);

  useLayoutEffect(() => {
    const sync = event => {
      if (event.key === FONT_SIZE_KEY || event.key === null) setFontSizeState(readFontSize());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const setFontSize = value => {
    const next = normalizeFontSize(value);
    setFontSizeState(next);
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      setStorageError(false);
    } catch { setStorageError(true); }
  };

  return <AppearanceContext.Provider value={{ fontSize, setFontSize, storageError }}>{children}</AppearanceContext.Provider>;
}

export function useAppearanceSettings() {
  return useContext(AppearanceContext);
}
