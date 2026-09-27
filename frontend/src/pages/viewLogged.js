import React from "react";
import Footer from "../components/footer";
import View from "../components/view";
import ResponsiveAppBar from "../components/navbarNew";

const ViewLoggedPage = () => <div className="home-page">
  <ResponsiveAppBar />
  <main className="home-page-main"><View /></main>
  <Footer />
</div>;
export default ViewLoggedPage;
