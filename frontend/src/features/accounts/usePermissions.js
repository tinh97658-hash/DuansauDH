import { useCallback } from "react";
import { useAuthSession } from "../../context/AuthSession";
import { permissionRoute,routeViewCode,routeActionCode } from './routePermissions';

/**
 * Đọc tập quyền hiệu lực của nhân sự đã được nạp vào AuthSessionContext
 * (từ `GET /accounts/me/permissions`). Dùng để ẩn/hiện chức năng theo quyền.
 */
export const usePermissions = () => {
  const session = useAuthSession();
  const access = session?.access;
  const can = useCallback(
    (permission) => {
      if (!access) return false;
      if (access.groupScope?.readOnly && !permission.endsWith('.view') && !permission.startsWith('module.')) return false;
      const route=permissionRoute(access.routeCatalog,session?.currentPath);
      if(route&&!permission.startsWith('route.')&&!permission.startsWith('module.')){
        if(!(access.permissions||[]).includes(routeViewCode(route.path)))return false;
        if(!permission.endsWith('.view')&&(!route.actions.includes(permission)||!(access.permissions||[]).includes(routeActionCode(route.path,permission))))return false;
      }
      return (access.permissions || []).includes(permission);
    },
    [access,session?.currentPath],
  );
  return { access, can };
};
