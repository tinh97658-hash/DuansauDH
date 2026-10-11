import React from "react";
import { useLocation } from "react-router-dom";
import { HomeHero, OverviewFooter } from "../components/overviewPages";
import Footer from "../components/footer";
import View from "../components/view";
import ResponsiveAppBar from "../components/navbarNew";

const ViewLoggedPage = () => {
  const { pathname } = useLocation();
  if (pathname === "/") return <div className="overview-page overview-home-page"><ResponsiveAppBar /><main className="overview-home-main"><HomeHero /></main><OverviewFooter /></div>;
  return <div className="home-page">
  <ResponsiveAppBar />
  <main className="home-page-main"><View /></main>
  <Footer />
</div>;
};
export default ViewLoggedPage;
