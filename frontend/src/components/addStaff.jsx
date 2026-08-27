import React, { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AddStaff = () => {
  const [form, setForm] = useState({ name: "", email: "", role: "" });
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault(); setSubmitting(true);
    try { await axios.post("/admin/addStaff", form, { withCredentials: true }); toast.success("Thêm nhân sự thành công"); setForm({ name: "", email: "", role: "" }); }
    catch (error) { toast.error(error.response?.data?.message || "Không thể thêm nhân sự"); }
    finally { setSubmitting(false); }
  };
  return <main className="card p-4" style={{ width: "100%", maxWidth: 800 }}>
    <h1 style={{ fontWeight: 400 }}>Thêm nhân sự</h1>
    <p className="text-muted">Cấp tài khoản nội bộ cho cán bộ tham gia quản lý và đánh giá đào tạo.</p>
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="mb-3"><label htmlFor="staff-name" className="form-label fw-bold">Họ và tên</label><input id="staff-name" className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
      <div className="mb-3"><label htmlFor="staff-email" className="form-label fw-bold">Địa chỉ email</label><input id="staff-email" className="form-control" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
      <div className="mb-4"><label htmlFor="staff-role" className="form-label fw-bold">Vai trò</label><select id="staff-role" className="form-select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required>
        <option value="">Chọn vai trò</option><option value="admin">Quản trị viên</option><option value="supervisor">Giảng viên hướng dẫn</option><option value="examiner">Giám khảo</option>
      </select></div>
      <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Đang xử lý..." : "Thêm nhân sự"}</button>
      <ToastContainer position="top-center" />
    </form>
  </main>;
};
export default AddStaff;
