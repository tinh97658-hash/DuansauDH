import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import ReviewTable from "../components/reviewTable";

function ReviewTablePage() {
  return (
    <FeatureLayout title="Bảng đánh giá luận văn / tiến độ" hideHeader={false}>
      <ReviewTable />
    </FeatureLayout>
  );
}

export default ReviewTablePage;