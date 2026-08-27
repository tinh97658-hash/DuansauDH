import React from "react";
import ResponsiveAppBar from "../components/navbarNew";
import Footer from "../components/footer";
import ReviewerDashBoard from "../components/dashboard/reviewerDashboard";

function Reviewer() {
  return (
    <div>
      <div style={{ marginBottom: "100px" }}>
        <ResponsiveAppBar />
      </div>

      <div>
        <ReviewerDashBoard />
      </div>

      <div style={{ marginTop: "10px" }}>
        <Footer />
      </div>
    </div>
  );
}

export default Reviewer;
