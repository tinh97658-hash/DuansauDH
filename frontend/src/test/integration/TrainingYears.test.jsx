import React, { useState } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { renderWithPermissions } from "../renderWithPermissions";
import TrainingYears from "../../pages/system/trainingYears";
import useTrainingYears from "../../hooks/useTrainingYears";

vi.mock("axios");
vi.mock("../../components/FeatureLayout", () => ({ default: ({ children }) => <div>{children}</div> }));

it("edits a year and saves its start date as an ISO date", async () => {
  const row = { id: "year-2026", name: "2026", startDate: "2026-01-01", active: true };
  axios.get.mockResolvedValue({ data: [row] });
  axios.put.mockResolvedValue({ data: { ...row, startDate: "2026-09-05" } });
  renderWithPermissions(<TrainingYears />, ["catalog.manage"]);
  fireEvent.doubleClick(await screen.findByText("2026"));
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "05/09/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/system/training-years/year-2026"),
    { name: "2026", startDate: "2026-09-05", active: true }, { withCredentials: true }));
});

it("uses configured active years and chooses the latest started year", async () => {
  axios.get.mockResolvedValue({ data: [
    { name: "2024", startDate: "2024-09-01", active: false },
    { name: "2025", startDate: "2025-09-01", active: true },
    { name: "2099", startDate: "2099-09-01", active: true },
  ] });
  function Picker() {
    const [year, setYear] = useState("2024");
    const years = useTrainingYears(year, setYear);
    return <><span data-testid="selected">{year}</span><span data-testid="options">{years.join(",")}</span></>;
  }
  renderWithPermissions(<Picker />, []);
  await waitFor(() => expect(screen.getByTestId("options")).toHaveTextContent("2025,2099"));
  await waitFor(() => expect(screen.getByTestId("selected")).toHaveTextContent("2025"));
});
