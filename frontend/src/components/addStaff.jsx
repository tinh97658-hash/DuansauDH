import React, { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Box, Button, Card, CardContent, FormControl, InputLabel,
  MenuItem, Select, Stack, TextField, Typography
} from "@mui/material";

const AddStaff = () => {
  const [form, setForm] = useState({ name: "", email: "", role: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await axios.post("/admin/addStaff", form, { withCredentials: true });
      toast.success("Thêm nhân sự thành công");
      setForm({ name: "", email: "", role: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể thêm nhân sự");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 640, mx: "auto" }}>
      <Card variant="outlined" sx={{ borderRadius: "6px", borderColor: "#DFE4E8" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#173E75", mb: 0.5 }}>
            Thêm nhân sự
          </Typography>
          <Typography variant="body2" sx={{ color: "#607486", mb: 3 }}>
            Cấp tài khoản nội bộ cho cán bộ tham gia quản lý và đánh giá đào tạo.
          </Typography>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                size="small"
                label="Họ và tên"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "4px" } }}
              />
              <TextField
                fullWidth
                size="small"
                type="email"
                label="Địa chỉ email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "4px" } }}
              />
              <FormControl fullWidth size="small" required>
                <InputLabel id="staff-role-label">Vai trò</InputLabel>
                <Select
                  labelId="staff-role-label"
                  label="Vai trò"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  sx={{ borderRadius: "4px" }}
                >
                  <MenuItem value="">Chọn vai trò</MenuItem>
                  <MenuItem value="admin">Quản trị viên</MenuItem>
                  <MenuItem value="supervisor">Giảng viên hướng dẫn</MenuItem>
                  <MenuItem value="examiner">Giám khảo</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{
                    borderRadius: "4px",
                    textTransform: "none",
                    bgcolor: "#0788B8",
                    fontWeight: 700,
                    "&:hover": { bgcolor: "#06729b" }
                  }}
                >
                  {submitting ? "Đang xử lý..." : "Thêm nhân sự"}
                </Button>
              </Box>
            </Stack>
            <ToastContainer position="top-center" />
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AddStaff;
