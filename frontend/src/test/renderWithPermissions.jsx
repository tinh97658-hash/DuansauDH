import React from "react";
import { render } from "@testing-library/react";
import { AuthSessionContext } from "../context/AuthSession";

export const renderWithPermissions = (ui, permissions, options) => {
  const Wrapper = ({ children }) => (
    <AuthSessionContext.Provider value={{ authenticated: true, user: { role: "custom" }, access: { permissions, roles: ["custom"] } }}>
      {children}
    </AuthSessionContext.Provider>
  );
  return render(ui, { ...options, wrapper: Wrapper });
};
