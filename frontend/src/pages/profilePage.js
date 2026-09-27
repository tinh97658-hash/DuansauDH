import React from "react";
import Profile from "../components/profile";
import ResponsiveAppBar from "../components/navbarNew";
import Footer from "../components/footer";

function ProfilePage() {
  return (
    <div class="container">
      <div style={{ marginBottom: "10px" }}>
        <ResponsiveAppBar />
      </div>

      <div
        class="row justify-content-md-center"
        style={{ marginTop: "65px", marginBottom: "20px" }}
      >
        <Profile />
      </div>

      <div style={{ marginTop: "10px" }}>
        <Footer />
      </div>
    </div>
  );
}

export default ProfilePage;
