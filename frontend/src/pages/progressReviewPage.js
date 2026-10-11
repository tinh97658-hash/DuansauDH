import React from "react";
import ProgressReview from "../components/infoPages/progress";
import ResponsiveAppBar from "../components/navbarNew";
import { OverviewFooter } from "../components/overviewPages";

export default function ProgressReviewPage() {
  return <div className="overview-page overview-information-page"><ResponsiveAppBar /><main><ProgressReview /></main><OverviewFooter /></div>;
}
