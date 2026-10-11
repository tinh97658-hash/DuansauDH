import React from "react";
import AppProcedure from "../components/infoPages/procedure";
import ResponsiveAppBar from "../components/navbarNew";
import { OverviewFooter } from "../components/overviewPages";

export default function ProcedurePage() {
  return <div className="overview-page overview-information-page"><ResponsiveAppBar /><main><AppProcedure /></main><OverviewFooter /></div>;
}
