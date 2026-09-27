import React, { useState } from "react";
import { Button, Card, CardContent, TextField } from "@mui/material";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";

const ReviewerDashboard = () => {
  const { state } = useLocation();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    try { await axios.post("/data/submitreview", { ...state, comment }, { withCredentials: true }); toast.success("Gửi nhận xét thành công"); }
    catch (error) { toast.error(error.response?.data?.message || "Không thể gửi nhận xét"); }
    finally { setSubmitting(false); }
  };
  return <Card variant="outlined" sx={{ width: "100%", maxWidth: 1000 }}><CardContent sx={{ p: { xs: 3, md: 4 } }}>
    <h1 style={{ fontWeight: 400 }}>Đánh giá học viên</h1>
    <p className="text-muted">Nhập nhận xét chuyên môn và kết luận đánh giá.</p>
    <TextField label="Nội dung nhận xét" placeholder="Nhập nhận xét tại đây" multiline rows={12} fullWidth value={comment} onChange={(event) => setComment(event.target.value)} />
    <Button variant="contained" color="success" onClick={submit} disabled={submitting || !comment.trim()} sx={{ mt: 3 }}>{submitting ? "Đang gửi..." : "Gửi nhận xét"}</Button>
    <ToastContainer position="top-center" />
  </CardContent></Card>;
};
export default ReviewerDashboard;
