// Claim a refresh before scheduling React state: focus and visibilitychange
// often arrive together, before a request's loading flag has been updated.
export function listenForBackgroundRefresh(refresh, { canRefresh = () => true, interval = 0, minInterval = 30000 } = {}) {
  let lastRefresh = Date.now();
  const check = (event) => {
    if (event?.type === "focus" && event.target?.nodeType === 1) return;
    if (document.visibilityState === "hidden" || !canRefresh() || Date.now() - lastRefresh < minInterval) return;
    lastRefresh = Date.now();
    refresh();
  };
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  const timer = interval ? window.setInterval(check, interval) : null;
  return () => {
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", check);
    if (timer !== null) window.clearInterval(timer);
  };
}
