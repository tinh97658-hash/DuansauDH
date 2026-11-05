import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import StudentDashboard from "../components/dashboard/studentMainDashboard";
import { ArrowLeftIcon } from "../components/AppIcons";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

function StudentDashBoardPage() {
  const navigate = useNavigate();

  const moveBack = () => {
    navigate("/procedure");
  };

  return (
    <FeatureLayout
      title="Bảng thông tin học viên"
      hideHeader={false}
      actions={
        <Button
          variant="outlined"
          startIcon={<ArrowLeftIcon />}
          onClick={moveBack}
          sx={{ textTransform: "none", borderRadius: "4px" }}
        >
          Quay lại
        </Button>
      }
    >
      <StudentDashboard />
    </FeatureLayout>
  );
}

export default StudentDashBoardPage;
