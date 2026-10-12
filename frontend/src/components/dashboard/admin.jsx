import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Alert, Box, CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography
} from "@mui/material";
import { personNameParts } from "../../utils/personName";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/data/admin/dashboard", { withCredentials: true })
      .then(({ data }) => setStudents(data.users || []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải danh sách học viên"));
  }, []);

  if (error) return <Alert severity="error" sx={{ my: 2, borderRadius: "4px" }}>{error}</Alert>;
  if (!students) return <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}><CircularProgress aria-label="Đang tải danh sách" /></Box>;

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#173E75", mb: 2 }}>
        Danh sách học viên và nghiên cứu sinh
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "6px", borderColor: "#DFE4E8" }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#F0F4F8" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Họ đệm</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Tên</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Mã học viên</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Chương trình</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Hình thức</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Hướng nghiên cứu</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.length ? (
              students.map((student) => {
                const name = personNameParts(student);
                return (
                  <TableRow
                    key={student._id || student.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate("/profile", { state: student._id || student.id })}
                  >
                    <TableCell>{name.familyAndMiddle}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{name.givenName}</TableCell>
                    <TableCell>{student.regNo || "—"}</TableCell>
                    <TableCell>{student.degree || "—"}</TableCell>
                    <TableCell>{student.studyMode || "—"}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.researchArea || "—"}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: "#607486" }}>
                  Chưa có dữ liệu học viên.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminDashboard;
