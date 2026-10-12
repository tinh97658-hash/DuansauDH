import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import AppProcedure from "../components/infoPages/procedure";

function ProcedurePage() {
  return (
    <FeatureLayout title="Quy trình đào tạo sau đại học" hideHeader={false}>
      <AppProcedure />
    </FeatureLayout>
  );
}

export default ProcedurePage;