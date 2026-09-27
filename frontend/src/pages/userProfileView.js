import React from "react";
import Footer from "../components/footer";
import ResponsiveAppBar from "../components/navbarNew";
import Profile from "../components/profileView";

// Function for showing information pages on post graduate programme

function UserProfile() {
  return (
    <div>
      <div style={{ marginBottom: "100px" }}>
        <ResponsiveAppBar />
      </div>

      <div>
        <Profile />
      </div>

      <div style={{ marginTop: "10px" }}>
        <Footer />
      </div>
    </div>
  );
}

export default UserProfile;
