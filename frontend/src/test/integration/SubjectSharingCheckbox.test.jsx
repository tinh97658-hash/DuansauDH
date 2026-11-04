import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import SubjectSharingCheckbox from "../../components/SubjectSharingCheckbox";
import theme from "../../theme";

const majors = [
  { id: "own", name: "Công nghệ thông tin", program: "masters", active: true },
  { id: "finance", name: "Quản lý tài chính", program: "masters", active: true },
  { id: "logistics", name: "Quản lý vận tải và Logistics", program: "masters", active: true },
];
const subject = { id: "subject", name: "Triết học", credits: 3, majorId: "own", program: "masters", sharedMajorIds: ["finance"] };
const matches = majors.slice(1).map(major => ({ ...subject, id: `subject-${major.id}`, majorId: major.id, active: true }));
const mount = (onChange, subjects = matches) => render(<ThemeProvider theme={theme}>
  <SubjectSharingCheckbox subject={subject} majors={majors} subjects={subjects} onChange={onChange} />
</ThemeProvider>);

it("searches majors without accents and keeps selections hidden by the search", async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  mount(onChange);
  fireEvent.mouseDown(screen.getByLabelText("Phạm vi học chung: Triết học"));
  expect(screen.getAllByRole("option")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Tìm chuyên ngành học chung"), { target: { value: "van tai" } });
  expect(screen.queryByRole("option", { name: "Quản lý tài chính" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: "Quản lý vận tải và Logistics" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({
    sharedMajorIds: ["finance", "logistics"], allowCrossMajor: true, canonicalSubjectId: null,
  }));
});

it("discloses the sharing scope and shows a search empty state without changing data", () => {
  const onChange = vi.fn();
  mount(onChange);
  fireEvent.mouseDown(screen.getByLabelText("Phạm vi học chung: Triết học"));
  expect(screen.getByText("Đã chọn 1 / 2 ngành đủ điều kiện")).toBeInTheDocument();
  expect(screen.getByText(/Chỉ chọn ngành có học phần đang hoạt động/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tìm chuyên ngành học chung"), { target: { value: "không có" } });
  expect(screen.getByText("Không tìm thấy chuyên ngành phù hợp.")).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it.each([
  { name: "Triết học khác" }, { credits: 2 }, { active: false }, { program: "doctoral" },
  { name: "Triet hoc" }, { name: "triết học" },
])("disables a major without an exact active counterpart: %j", patch => {
  const onChange = vi.fn();
  mount(onChange, [matches[0], { ...matches[1], ...patch }]);
  fireEvent.mouseDown(screen.getByLabelText("Phạm vi học chung: Triết học"));
  const option = screen.getByRole("option", { name: /Quản lý vận tải và Logistics/ });
  expect(option).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(option);
  expect(onChange).not.toHaveBeenCalled();
});

it("selects only eligible majors and can clear stale saved selections explicitly", async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  mount(onChange, [matches[1]]);
  fireEvent.mouseDown(screen.getByLabelText("Phạm vi học chung: Triết học"));
  expect(screen.getByText(/Có 1 ngành đã chọn trước đây không còn phù hợp/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: "Bỏ các ngành không phù hợp" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ sharedMajorIds: [], allowCrossMajor: false, canonicalSubjectId: null }));
});

it("keeps the saved-scope warning compact and exposes its full explanation on hover", () => {
  mount(vi.fn(), []);
  const control = screen.getByLabelText("Phạm vi học chung: Triết học");
  expect(control).toHaveTextContent("1 ngành ⚠");
  expect(control).not.toHaveTextContent("(1 chưa phù hợp)");
  expect(control.closest('.MuiInputBase-root')).toHaveAttribute('title', expect.stringContaining('1 ngành chưa phù hợp'));
});

it("limits select-all to majors with the same name and credits", async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  mount(onChange, [matches[1]]);
  fireEvent.mouseDown(screen.getByLabelText("Phạm vi học chung: Triết học"));
  fireEvent.click(screen.getByRole("option", { name: /Chọn tất cả/ }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ sharedMajorIds: ["logistics"], allowCrossMajor: true, canonicalSubjectId: null }));
});
