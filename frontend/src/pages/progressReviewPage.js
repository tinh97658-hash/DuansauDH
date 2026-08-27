import React from "react";
import ProgressReview from "../components/infoPages/progress";
import Footer from "../components/footer";
import ResponsiveAppBar from "../components/navbarNew";

// Function for showing information pages on post graduate programme

function ProgressReviewPage() {
  return (
    <div>
      <div style={{ marginBottom: "100px" }}>
        <ResponsiveAppBar />
      </div>

      <div>
        <ProgressReview />
      </div>

      <div style={{ marginTop: "10px" }}>
        <Footer />
      </div>
    </div>
  );
}

export default ProgressReviewPage;
