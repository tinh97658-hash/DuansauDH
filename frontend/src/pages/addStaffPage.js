import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import AddStaff from "../components/addStaff";

function AddStaffPage() {
  return (
    <FeatureLayout title="Thêm nhân sự" hideHeader={false}>
      <AddStaff />
    </FeatureLayout>
  );
}

export default AddStaffPage;
