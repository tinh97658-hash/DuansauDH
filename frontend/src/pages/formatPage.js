import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import Format from "../components/infoPages/format";

function FormatPage() {
  return (
    <FeatureLayout title="Định dạng văn bản & luận văn" hideHeader={false}>
      <Format />
    </FeatureLayout>
  );
}

export default FormatPage;
