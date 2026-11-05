import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Outlet, useBlocker } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";

const GuardContext = createContext(null);
export const UNSAVED_GRADE_MESSAGE = "Bạn đã chỉnh sửa điểm nhưng chưa lưu. Nếu rời khỏi trang, những thay đổi này sẽ bị mất.";

export function useUnsavedChanges(dirty,message=UNSAVED_GRADE_MESSAGE) {
  const guard = useContext(GuardContext);
  useEffect(() => {
    guard?.setDirty(dirty,message);
    return () => guard?.setDirty(false);
  }, [guard?.setDirty, dirty,message]);
}
export const useUnsavedGrades=dirty=>useUnsavedChanges(dirty);

export function useConfirmGradeLeave() {
  return useContext(GuardContext)?.confirmLeave || (() => Promise.resolve(true));
}
export function useDiscardUnsavedGrades() {
  const guard = useContext(GuardContext);
  return () => guard?.setDirty(false);
}

export default function UnsavedChangesGuard() {
  const [dirty, updateDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [message,setMessage]=useState(UNSAVED_GRADE_MESSAGE);
  const setDirty = useCallback((value,nextMessage=UNSAVED_GRADE_MESSAGE) => { dirtyRef.current = value; updateDirty(value);setMessage(nextMessage); }, []);
  const [manual, setManual] = useState(false);
  const resolver = useRef(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search
  ));
  const confirmLeave = useCallback(() => {
    if (!dirty) return Promise.resolve(true);
    if (resolver.current) return Promise.resolve(false);
    setManual(true);
    return new Promise(resolve => { resolver.current = resolve; });
  }, [dirty]);
  const answer = proceed => {
    const resolve = resolver.current;
    resolver.current = null;
    setManual(false);
    if (blocker.state === "blocked") {
      if (proceed) blocker.proceed(); else blocker.reset();
    }
    resolve?.(proceed);
  };
  useEffect(() => () => resolver.current?.(false), []);
  return <GuardContext.Provider value={{ setDirty, confirmLeave }}>
    <Outlet />
    <ConfirmDialog open={manual || blocker.state === "blocked"} onClose={() => answer(false)}
      title={message===UNSAVED_GRADE_MESSAGE?'CÓ ĐIỂM CHƯA LƯU':'CÓ THAY ĐỔI CHƯA LƯU'} content={message} cancelText="Ở lại"
      confirmText="Bỏ thay đổi và tiếp tục" severity="warning" onConfirm={() => answer(true)} />
  </GuardContext.Provider>;
}
