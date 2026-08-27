import React from "react";
import Footer from "../components/footer";
import View from "../components/view";
import ResponsiveAppBar from "../components/navbarNew";

const ViewLoggedPage = () => <div>
  <ResponsiveAppBar />
  <main style={{ padding: "40px 24px" }}><View /></main>
  <Footer />
</div>;
export default ViewLoggedPage;
