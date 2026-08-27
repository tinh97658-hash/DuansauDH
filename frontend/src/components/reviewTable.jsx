import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const ReviewTable = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { axios.get("/data/tobereviewed", { withCredentials: true })
    .then(({ data }) => setStudents(data.usersWithRelevantNames || []))
    .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải danh sách cần đánh giá")); }, []);
  return <div className="container">
    <h1 className="mb-4" style={{ fontWeight: 400 }}>Học viên cần đánh giá</h1>
    {error && <div className="alert alert-danger">{error}</div>}
    <table className="table table-striped"><thead><tr><th>Họ và tên học viên</th><th>Thao tác</th></tr></thead>
      <tbody>{students.length ? students.map((student) => <tr key={student._id}><td>{student.fullName}</td><td><button className="btn btn-outline-primary btn-sm" onClick={() => navigate("/reviewer", { state: { studentId: student._id, supervisorId: student.supervisorId } })}>Mở phiếu đánh giá</button></td></tr>) : <tr><td colSpan="2" className="text-center text-muted">Chưa có học viên cần đánh giá.</td></tr>}</tbody>
    </table>
  </div>;
};
export default ReviewTable;
