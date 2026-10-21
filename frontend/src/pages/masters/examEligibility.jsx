import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Preserve bookmarked scopes while routing to the current eligibility workflow.
const ExamEligibility = () => {
  const { search } = useLocation();
  return <Navigate replace to={{ pathname: "/masters/exam-lists", search }} />;
};
export default ExamEligibility;
