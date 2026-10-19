import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import OperationalDashboard from "../features/dashboard/OperationalDashboard";

const ViewLoggedPage = () => {
  return (
    <FeatureLayout hideHeader={true}>
      <OperationalDashboard />
    </FeatureLayout>
  );
};

export default ViewLoggedPage;
