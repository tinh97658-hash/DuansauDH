import { useEffect, useRef, useState } from "react";

const key = "subject-catalog-revision";
const eventName = "subject-catalog-changed";
const readRevision = () => {
  try { return window.localStorage.getItem(key) || ""; } catch { return ""; }
};

export function notifySubjectCatalogChanged() {
  try { window.localStorage.setItem(key, `${Date.now()}-${Math.random()}`); } catch { /* Other mounted views still receive the event. */ }
  window.dispatchEvent(new Event(eventName));
}

// Refresh catalog projections in this tab and in other open tabs after a successful save.
export function useSubjectCatalogRevision(listenLocal = true) {
  const [revision, setRevision] = useState(0);
  const seen = useRef(readRevision());
  useEffect(() => {
    const refresh = () => { seen.current = readRevision(); setRevision(value => value + 1); };
    const check = () => { if (readRevision() !== seen.current) refresh(); };
    const storage = event => { if (event.key === key) check(); };
    if (listenLocal) window.addEventListener(eventName, refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [listenLocal]);
  return revision;
}
