import React from "react";
import { renderHook } from "@testing-library/react";
import { AuthSessionContext } from "../../context/AuthSession";
import { usePermissions } from "../../features/accounts/usePermissions";

it("does not infer permissions from admin or the obsolete superadmin flag", () => {
  const wrapper = ({ children }) => <AuthSessionContext.Provider value={{ user: { role: "admin" }, access: { superadmin: true, permissions: [] } }}>{children}</AuthSessionContext.Provider>;
  const { result } = renderHook(usePermissions, { wrapper });
  expect(result.current.can("role.manage")).toBe(false);
});

it('requires the current route action as well as the shared capability',()=>{
  const wrapper=({children})=><AuthSessionContext.Provider value={{currentPath:'/masters/schedule',access:{
    routeCatalog:[{path:'/masters/schedule',actions:['scheduling.write']}],
    permissions:['scheduling.view','scheduling.write','scheduling.organize','route.masters.schedule.view'],
  }}}>{children}</AuthSessionContext.Provider>;
  const {result}=renderHook(usePermissions,{wrapper});
  expect(result.current.can('scheduling.view')).toBe(true);
  expect(result.current.can('scheduling.write')).toBe(false);
  expect(result.current.can('scheduling.organize')).toBe(false);
});
it("grants explicit permissions to a custom role", () => {
  const wrapper = ({ children }) => <AuthSessionContext.Provider value={{ user: { role: "custom" }, access: { permissions: ["catalog.manage"] } }}>{children}</AuthSessionContext.Provider>;
  const { result } = renderHook(usePermissions, { wrapper });
  expect(result.current.can("catalog.manage")).toBe(true);
  expect(result.current.can("role.manage")).toBe(false);
});

it('keeps exam reads but denies exam writes for a readonly role',()=>{
  const wrapper=({children})=><AuthSessionContext.Provider value={{access:{permissions:['exams.view','exams.write'],groupScope:{readOnly:true}}}}>{children}</AuthSessionContext.Provider>;
  const {result}=renderHook(usePermissions,{wrapper});
  expect(result.current.can('exams.view')).toBe(true);
  expect(result.current.can('exams.write')).toBe(false);
});
