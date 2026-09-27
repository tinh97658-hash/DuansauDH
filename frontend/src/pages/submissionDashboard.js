import React from "react";
import Submission from "../components/dashboard/submission";
import Navbar from "../components/navbarNew";
import Footer from "../components/footer";

const SubmissionDashboard = () => {
  return (
    <div>
      <div style={{ marginBottom: "100px" }}>
        <Navbar />
      </div>

      <div>
        <Submission />
      </div>

      <div style={{ marginTop: "10px" }}>
        <Footer />
      </div>
    </div>
  );
};

export default SubmissionDashboard;
