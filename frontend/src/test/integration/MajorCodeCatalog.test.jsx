import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import Majors from "../../pages/system/majors";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("@mui/icons-material", () => ({
  AddRounded: require("@mui/icons-material/AddRounded").default,
  DeleteRounded: require("@mui/icons-material/DeleteRounded").default,
  EditRounded: require("@mui/icons-material/EditRounded").default,
  SearchRounded: require("@mui/icons-material/SearchRounded").default,
}));

const major = { id: "m1", code: "CNTT", name: "Công nghệ thông tin", disciplineId: "d1", program: "masters", active: true };

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.endsWith("/system/disciplines")) return { data: [{ id: "d1", name: "Ngành CNTT" }] };
    return { data: [major] };
  });
  axios.post.mockResolvedValue({ data: {} });
  axios.put.mockResolvedValue({ data: {} });
});

test("creates a specialization with its required code", async () => {
  render(<Majors />);
  fireEvent.click(await screen.findByRole("button", { name: "Thêm mới" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Mã chuyên ngành"), { target: { value: "CNTT2" } });
  fireEvent.change(dialog.getByLabelText("Tên chuyên ngành"), { target: { value: "Chuyên ngành mới" } });
  fireEvent.mouseDown(dialog.getByLabelText("Ngành đào tạo"));
  fireEvent.click(await screen.findByRole("option", { name: "Ngành CNTT" }));
  fireEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/system/majors"),
    expect.objectContaining({ code: "CNTT2", name: "Chuyên ngành mới", disciplineId: "d1" }),
    { withCredentials: true },
  ));
});

test("shows the current code and permits editing it", async () => {
  render(<Majors />);
  expect(await screen.findByText("CNTT")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByLabelText("Mã chuyên ngành")).toHaveValue("CNTT");
  fireEvent.change(dialog.getByLabelText("Mã chuyên ngành"), { target: { value: "IT" } });
  fireEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/system/majors/m1"),
    expect.objectContaining({ code: "IT" }),
    { withCredentials: true },
  ));
});
