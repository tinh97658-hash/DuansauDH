import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import FileUploader from "../components/fileUploader";

function FileUploadPage() {
  return (
    <FeatureLayout title="Tải lên tệp báo cáo" hideHeader={false}>
      <FileUploader />
    </FeatureLayout>
  );
}

export default FileUploadPage;