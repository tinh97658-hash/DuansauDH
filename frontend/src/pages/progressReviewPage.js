import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import ProgressReview from "../components/infoPages/progress";

function ProgressReviewPage() {
  return (
    <FeatureLayout title="Đánh giá tiến độ đào tạo" hideHeader={false}>
      <ProgressReview />
    </FeatureLayout>
  );
}

export default ProgressReviewPage;
