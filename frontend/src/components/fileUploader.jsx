import React, { useState } from "react";
import { Card, CardContent } from "@mui/material";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const FileUploader = () => {
  const { state: submissionNumber } = useLocation();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || !submissionNumber) return toast.error("Vui lòng chọn loại báo cáo và tệp cần nộp");
    setSubmitting(true);
    const form = new FormData();
    form.append("submission", submissionNumber);
    form.append("submissionFile", file);
    try {
      await axios.post("/user/submit", form, { withCredentials: true });
      toast.success("Nộp báo cáo thành công");
      setFile(null);
      event.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể nộp báo cáo");
    } finally { setSubmitting(false); }
  };
  return <Card sx={{ width: "100%", maxWidth: 900 }}><CardContent sx={{ p: { xs: 3, md: 5 } }}>
    <h1 style={{ fontWeight: 400 }}>Nộp tệp báo cáo</h1>
    <p className="text-muted">Kỳ báo cáo số: {submissionNumber || "chưa xác định"}</p>
    <form onSubmit={handleSubmit} className="mt-4">
      <label htmlFor="submission-file" className="form-label fw-bold">Chọn tệp báo cáo</label>
      <input id="submission-file" className="form-control" type="file" required onChange={(event) => setFile(event.target.files[0])} />
      <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>{submitting ? "Đang nộp..." : "Nộp báo cáo"}</button>
    </form>
    <ToastContainer position="top-center" />
  </CardContent></Card>;
};
export default FileUploader;
