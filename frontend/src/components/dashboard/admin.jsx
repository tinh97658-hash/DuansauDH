import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { CircularProgress } from "@mui/material";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    axios.get("/data/admin/dashboard", { withCredentials: true })
      .then(({ data }) => setStudents(data.users || []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải danh sách học viên"));
  }, []);
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!students) return <div className="text-center p-5"><CircularProgress aria-label="Đang tải danh sách" /></div>;
  return <div className="container-fluid">
    <h1 className="mb-4" style={{ fontWeight: 400 }}>Danh sách học viên và nghiên cứu sinh</h1>
    <div className="table-responsive"><table className="table table-striped table-hover align-middle">
      <thead><tr><th>Họ và tên</th><th>Mã học viên</th><th>Chương trình</th><th>Hình thức</th><th>Email</th><th>Hướng nghiên cứu</th></tr></thead>
      <tbody>{students.length ? students.map((student) => <tr key={student._id || student.id} role="button" onClick={() => navigate("/profile", { state: student._id || student.id })}>
        <td>{student.fullName}</td><td>{student.regNo || "—"}</td><td>{student.degree || "—"}</td><td>{student.studyMode || "—"}</td><td>{student.email}</td><td>{student.researchArea || "—"}</td>
      </tr>) : <tr><td colSpan="6" className="text-center text-muted py-4">Chưa có dữ liệu học viên.</td></tr>}</tbody>
    </table></div>
  </div>;
};
export default AdminDashboard;
