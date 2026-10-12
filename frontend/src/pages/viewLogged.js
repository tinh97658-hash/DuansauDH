import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import View from "../components/view";

const ViewLoggedPage = () => {
  return (
    <FeatureLayout hideHeader={true}>
      <View />
    </FeatureLayout>
  );
};

export default ViewLoggedPage;
