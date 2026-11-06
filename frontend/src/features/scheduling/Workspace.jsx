import React from "react";
import FeatureLayout from "../../components/FeatureLayout";
import { api, Notice, useLoad } from "./shared";
import CreateOffering from "./CreateOffering";
import Schedule from "./Schedule";
import CourseMatrix from "./CourseMatrix";
import { useAuthSession } from "../../context/AuthSession";

export default function Workspace({ mode }) {
  const verifiedSession = useAuthSession();
  const session = useLoad(signal => verifiedSession || api.get("/auth/session", { signal }), [verifiedSession]);
  const user = (verifiedSession || session.data)?.user;
  return <FeatureLayout title={mode === "matrix" ? "Ma trận lớp học phần" : mode === "create" ? "Tạo lớp học phần" : "Lịch học"} exportConfig={mode === "create" ? false : undefined} hideHeader workspaceMode={mode !== "matrix"} contentPadding={mode === "schedule" ? 0 : undefined}><div className={`scheduling-v20 v20-workspace ${mode === "create" ? "v20-create-workspace" : mode === "schedule" ? "v20-schedule-workspace" : mode === "matrix" ? "v20-matrix-workspace" : ""}`}>
    {session.loading && !verifiedSession ? <Notice>Đang tải quyền truy cập...</Notice> : session.error && !user ? <Notice error={session.error} /> : !user ? <Notice error="Vui lòng đăng nhập để sử dụng chức năng." /> : mode === "create" ? <CreateOffering key={user.id || user.email || user.role} user={user} /> : mode === "matrix" ? <CourseMatrix user={user} /> : <Schedule user={user} />}
  </div></FeatureLayout>;
}
