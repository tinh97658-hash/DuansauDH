import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import Submission from "../components/dashboard/submission";

const SubmissionDashboard = () => {
  return (
    <FeatureLayout title="Nộp báo cáo tiến độ" hideHeader={false}>
      <Submission />
    </FeatureLayout>
  );
};

export default SubmissionDashboard;
