import { useCallback } from "react";
import { useAuthSession } from "../../context/AuthSession";

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
      if (access.groupScope?.readOnly && /^(groups\.assign|(?:masters|doctoral|plan|admission)\.manage|scheduling\.(write|organize|assign)|gradebook\.(submit|approve|policy)|studyleave\.manage)$/.test(permission)) return false;
      return (access.permissions || []).includes(permission);
    },
    [access],
  );
  return { access, can };
};
