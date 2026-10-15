import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography
} from "@mui/material";
import { personNameParts } from "../utils/personName";

const ReviewTable = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/data/tobereviewed", { withCredentials: true })
      .then(({ data }) => setStudents(data.usersWithRelevantNames || []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải danh sách cần đánh giá"));
  }, []);

  return (
    <Box sx={{ width: "100%", maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#173E75", mb: 2 }}>
        Học viên cần đánh giá
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "4px" }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "6px", borderColor: "#DFE4E8" }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#F0F4F8" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Họ đệm</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#173E75" }}>Tên</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: "#173E75" }}>Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.length ? (
              students.map((student) => {
                const name = personNameParts(student);
                return (
                  <TableRow key={student._id} hover>
                    <TableCell>{name.familyAndMiddle}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{name.givenName}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate("/reviewer", { state: { studentId: student._id, supervisorId: student.supervisorId } })}
                        sx={{ textTransform: "none", borderRadius: "4px", fontSize: 12 }}
                      >
                        Mở phiếu đánh giá
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: "#607486" }}>
                  Chưa có học viên cần đánh giá.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ReviewTable;
