import React, { useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./appToast.css";

export default function AppToaster() {
  useEffect(() => toast.onChange?.(({ status, type, id, containerId }) => {
    if (status === "added" && type === "error" && containerId == null) toast.update(id, { autoClose: 8000 });
  }), []);
  return <ToastContainer enableMultiContainer position="top-right" newestOnTop limit={3}
    autoClose={3000} closeButton pauseOnFocusLoss pauseOnHover theme="light" toastClassName="app-toast" />;
}
