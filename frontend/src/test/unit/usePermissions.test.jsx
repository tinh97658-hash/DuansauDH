import React from "react";
import { renderHook } from "@testing-library/react";
import { AuthSessionContext } from "../../context/AuthSession";
import { usePermissions } from "../../features/accounts/usePermissions";

it("does not infer permissions from admin or the obsolete superadmin flag", () => {
  const wrapper = ({ children }) => <AuthSessionContext.Provider value={{ user: { role: "admin" }, access: { superadmin: true, permissions: [] } }}>{children}</AuthSessionContext.Provider>;
  const { result } = renderHook(usePermissions, { wrapper });
  expect(result.current.can("role.manage")).toBe(false);
});
it("grants explicit permissions to a custom role", () => {
  const wrapper = ({ children }) => <AuthSessionContext.Provider value={{ user: { role: "custom" }, access: { permissions: ["catalog.manage"] } }}>{children}</AuthSessionContext.Provider>;
  const { result } = renderHook(usePermissions, { wrapper });
  expect(result.current.can("catalog.manage")).toBe(true);
  expect(result.current.can("role.manage")).toBe(false);
});
