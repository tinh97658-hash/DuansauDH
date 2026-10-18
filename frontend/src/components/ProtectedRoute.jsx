import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthSessionContext } from "../context/AuthSession";

const ProtectedRoute = () => {
  const location = useLocation();
  const [status, setStatus] = useState("checking");
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    axios.get("/auth/session", { withCredentials: true })
      .then(({ data }) => { if (mounted) { setSession(data); setStatus(data.authenticated ? "authenticated" : "anonymous"); } })
      .catch(() => { if (mounted) setStatus("anonymous"); });
    return () => { mounted = false; };
  }, []);

  if (status === "checking") {
    return <main className="auth-checking" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
  return <AuthSessionContext.Provider value={session}><Outlet /></AuthSessionContext.Provider>;
};

export default ProtectedRoute;
