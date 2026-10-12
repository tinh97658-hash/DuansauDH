/**
 * Helper to safely bridge between tests that spy on window.confirm
 * and production UI where institutional ConfirmDialog is used.
 */
export function getMockConfirmResult(message) {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    if (window.confirm._isMockFunction || typeof window.confirm.mock !== "undefined") {
      return Boolean(window.confirm(message));
    }
  }
  return null;
}
