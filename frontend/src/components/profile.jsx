import React from "react";
import { useLocation } from "react-router-dom";
import { Alert } from "@mui/material";
import ProfileCard from "./ProfileCard";

const Profile = () => {
  const { state } = useLocation();
  return state ? (
    <ProfileCard endpoint={`/data/profile/${state}`} />
  ) : (
    <Alert severity="warning" sx={{ borderRadius: "4px", my: 2 }}>
      Chưa chọn học viên cần xem.
    </Alert>
  );
};

export default Profile;
