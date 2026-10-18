import { lazy } from "react";

const routes = new Map();

export function lazyPage(loader, paths = []) {
  let pending;
  const load = () => pending || (pending = loader().catch(error => { pending = undefined; throw error; }));
  paths.forEach(path => routes.set(path, load));
  return lazy(load);
}

export function preloadPage(path) {
  if (!path) return;
  const pathname = path.split(/[?#]/)[0];
  const match = routes.has(pathname) ? pathname : [...routes.keys()].find(route => {
    const segments = route.split("/");
    const target = pathname.split("/");
    return segments.length === target.length && segments.every((segment, index) => segment.startsWith(":") || segment === target[index]);
  });
  // Only module code is prefetched. Page effects and API calls run on navigation.
  if (match) routes.get(match)().catch(() => {});
}
