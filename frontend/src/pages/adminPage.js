import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import AdminDashboard from "../components/dashboard/admin";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

function AdminPage() {
  const navigate = useNavigate();

  const moveBack = () => {
    navigate("/procedure");
  };

  return (
    <FeatureLayout
      title="Bảng điều phối chương trình đào tạo"
      hideHeader={false}
      actions={
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={moveBack}
          sx={{ textTransform: "none", borderRadius: "4px" }}
        >
          Quay lại
        </Button>
      }
    >
      <AdminDashboard />
    </FeatureLayout>
  );
}

export default AdminPage;
