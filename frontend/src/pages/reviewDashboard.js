import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import ReviewerDashBoard from "../components/dashboard/reviewerDashboard";

function Reviewer() {
  return (
    <FeatureLayout title="Bảng đánh giá của giảng viên / hội đồng" hideHeader={false}>
      <ReviewerDashBoard />
    </FeatureLayout>
  );
}

export default Reviewer;
