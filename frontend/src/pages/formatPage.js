import React from "react";
import Format from "../components/infoPages/format";
import Footer from "../components/footer";
import ResponsiveAppBar from "../components/navbarNew";

// Function for showing information pages on post graduate programme

function FormatPage() {
  return (
    <div>
      <div style={{ marginBottom: "100px" }}>
        <ResponsiveAppBar />
      </div>

      <div>
        <Format />
      </div>

      <div style={{ marginTop: "10px" }}>
        <Footer />
      </div>
    </div>
  );
}

export default FormatPage;
