import React from "react";
import FeatureLayout from "../../components/FeatureLayout";
import { api, Notice, useLoad } from "./shared";
import CreateOffering from "./CreateOffering";
import Schedule from "./Schedule";
import CourseMatrix from "./CourseMatrix";
import "./reference.css";
import "./workspace.css";

export default function Workspace({ mode }) {
  const session = useLoad(() => api.get("/auth/session"), []);
  const user = session.data?.user;
  return <FeatureLayout hideHeader workspaceMode={mode !== "matrix"}><div className={`scheduling-v20 v20-workspace ${mode === "schedule" ? "v20-schedule-workspace" : mode === "matrix" ? "v20-matrix-workspace" : ""}`}>
    {session.loading ? <Notice>Đang tải quyền truy cập...</Notice> : session.error ? <Notice error={session.error} /> : !user ? <Notice error="Vui lòng đăng nhập để sử dụng chức năng." /> : mode === "create" ? <CreateOffering user={user} /> : mode === "matrix" ? <CourseMatrix user={user} /> : <Schedule user={user} />}
  </div></FeatureLayout>;
}
