import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthSessionContext } from "../context/AuthSession";

const EMPTY_ACCESS = { superadmin: false, permissions: [], roles: [] };
const CHANGE_PASSWORD_PATH = "/system/change-password";

const ProtectedRoute = () => {
  const location = useLocation();
  const [status, setStatus] = useState("checking");
  const [session, setSession] = useState(null);
  const [access, setAccess] = useState(null);

  const loadSession = useCallback(async () => {
    const { data } = await axios.get("/auth/session", { withCredentials: true });
    if (!data.authenticated) {
      setSession(null);
      setAccess(null);
      setStatus("anonymous");
      return false;
    }
    setSession(data);
    setStatus("authenticated");
    try {
      const { data: permissions } = await axios.get("/accounts/me/permissions", { withCredentials: true });
      setAccess(permissions || EMPTY_ACCESS);
    } catch {
      setAccess(EMPTY_ACCESS);
    }
    return true;
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSession().catch(() => mounted && setStatus("anonymous"));
    return () => {
      mounted = false;
    };
  }, [loadSession]);

  const value = useMemo(
    () => ({ ...(session || {}), access, refresh: loadSession }),
    [session, access, loadSession],
  );

  if (status === "checking") {
    return <main className="auth-checking" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;

  // Nhân sự còn mật khẩu khởi tạo phải đổi trước khi sử dụng các chức năng khác.
  if (session?.user?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <AuthSessionContext.Provider value={value}><Outlet /></AuthSessionContext.Provider>;
};

export default ProtectedRoute;
