/** Comparison key only: never replace the URL or resource IDs passed to handlers. */
export function authorizationPath(path: string): string {
  return path.split('?')[0].replace(/\/+$/, '').toLowerCase();
}
