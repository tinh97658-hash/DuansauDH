import React from "react";
import FeatureLayout from "../components/FeatureLayout";
import Appointment from "../components/infoPages/appointment";

function AppointmentPage() {
  return (
    <FeatureLayout title="Lịch hẹn hướng dẫn & đánh giá" hideHeader={false}>
      <Appointment />
    </FeatureLayout>
  );
}

export default AppointmentPage;