import React from "react";
import { render } from "@testing-library/react";
import { AuthSessionContext } from "../context/AuthSession";

export const renderWithPermissions = (ui, permissions, options) => render(
  <AuthSessionContext.Provider value={{ authenticated: true, user: { role: "custom" }, access: { permissions, roles: ["custom"] } }}>
    {ui}
  </AuthSessionContext.Provider>, options,
);
