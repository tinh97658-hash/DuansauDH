import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import Profile from "../components/profileView";

function UserProfile() {
  return (
    <FeatureLayout title="Hồ sơ cá nhân" hideHeader={false}>
      <Profile />
    </FeatureLayout>
  );
}

export default UserProfile;
