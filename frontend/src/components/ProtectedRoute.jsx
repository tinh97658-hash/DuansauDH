import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = () => {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let mounted = true;
    axios.get("/auth/session", { withCredentials: true })
      .then(({ data }) => { if (mounted) setStatus(data.authenticated ? "authenticated" : "anonymous"); })
      .catch(() => { if (mounted) setStatus("anonymous"); });
    return () => { mounted = false; };
  }, []);

  if (status === "checking") {
    return <main className="auth-checking" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
};

export default ProtectedRoute;
