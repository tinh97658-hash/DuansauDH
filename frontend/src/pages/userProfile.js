import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import Profile from "../components/profile";

function UserProfile() {
  return (
    <FeatureLayout title="Hồ sơ người dùng" hideHeader={false}>
      <Profile />
    </FeatureLayout>
  );
}

export default UserProfile;
