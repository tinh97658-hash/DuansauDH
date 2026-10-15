import { useEffect, useRef, useState } from "react";

const key = "exam-gradebook-revision";
const eventName = "exam-gradebook-saved";
const read = () => {
  try { return [localStorage.getItem(key), localStorage.getItem("grading-policy-revision")].join(":"); }
  catch { return ""; }
};

export function notifyGradebookSaved(source = "gradebook") {
  try { localStorage.setItem(key, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab refresh still works. */ }
  window.dispatchEvent(new CustomEvent(eventName, { detail: { source } }));
}

export function useGradebookRevision() {
  const [revision, setRevision] = useState(0);
  const seen = useRef(read());
  useEffect(() => {
    const refresh = () => { seen.current = read(); setRevision(value => value + 1); };
    const check = () => { if (read() !== seen.current) refresh(); };
    const storage = event => { if ([key, "grading-policy-revision"].includes(event.key)) check(); };
    window.addEventListener(eventName, refresh);
    window.addEventListener("grading-policy-changed", refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("grading-policy-changed", refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return revision;
}
