import React from "react";
import { useLocation } from "react-router-dom";
import ProfileCard from "./ProfileCard";
const Profile = () => {
  const { state } = useLocation();
  return state ? <ProfileCard endpoint={`/data/profile/${state}`} /> : <div className="alert alert-warning">Chưa chọn học viên cần xem.</div>;
};
export default Profile;
