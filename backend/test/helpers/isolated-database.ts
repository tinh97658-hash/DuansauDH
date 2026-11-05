export function isIsolatedScopeDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return /^\/pgsms_(?:group_scope_test|performance_test_\d{8}(?:_v\d+)?)$/.test(new URL(url).pathname);
  } catch { return false; }
}
