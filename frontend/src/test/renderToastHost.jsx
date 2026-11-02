import React from "react";
import { render } from "@testing-library/react";
import { toast } from "react-toastify";
import AppToaster from "../components/AppToaster";

// Feature tests mount the application-level host separately from their mocked layout.
export function renderToastHost() {
  toast.dismiss();
  toast.clearWaitingQueue();
  render(<AppToaster />);
}
