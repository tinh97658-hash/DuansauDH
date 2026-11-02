import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Link } from "react-router-dom";
import { toast } from "react-toastify";
import AppToaster from "../../components/AppToaster";
import UnsavedChangesGuard, { useUnsavedGrades } from "../../components/UnsavedChangesGuard";
import { draftOf, updateGradeDraft } from "../../features/exams/gradebook";
import { hasGradeChanges } from "../../utils/gradebookNavigation";

vi.mock("../../components/ConfirmDialog", () => ({ default: ({ open, title, content, onClose, onConfirm, cancelText, confirmText }) => open ?
  <div role="dialog"><h2>{title}</h2><p>{content}</p><button onClick={onClose}>{cancelText}</button><button onClick={onConfirm}>{confirmText}</button></div> : null }));
const baseline = () => draftOf({ participantId: "one", testScore: 6, assignmentScore: null, examScore: null, examExempt: false, notes: "", letterGrade: "", workflowPhase: "components" });
function Editor() {
  const [saved, setSaved] = useState(baseline), [row, setRow] = useState(baseline), [mode, setMode] = useState(false);
  useUnsavedGrades(hasGradeChanges(saved, row));
  return <><input aria-label="Điểm" value={row.testScore} onChange={e => setRow(updateGradeDraft(row, { testScore: e.target.value }))} />
    <button onClick={() => setSaved(row)}>Lưu</button><button onClick={() => setMode(!mode)}>Đổi hiển thị</button><span>{String(mode)}</span><Link to="/after">Menu khác</Link></>;
}
function mountEditor() {
  const router = createMemoryRouter([{ element: <UnsavedChangesGuard />, children: [
    { path: "/grade", element: <Editor /> }, { path: "/before", element: <h1>Before</h1> }, { path: "/after", element: <h1>After</h1> },
  ] }], { initialEntries: ["/before", "/grade", "/after"], initialIndex: 1 });
  render(<RouterProvider router={router} />); return router;
}
it("guards a router Link, cancels without changing data, then follows exactly that destination", async () => {
  const router = mountEditor(); fireEvent.change(screen.getByLabelText("Điểm"), { target: { value: "7" } });
  fireEvent.click(screen.getByText("Menu khác")); expect(await screen.findByRole("dialog")).toHaveTextContent("CÓ ĐIỂM CHƯA LƯU");
  fireEvent.click(screen.getByText("Ở lại")); expect(screen.getByLabelText("Điểm")).toHaveValue("7"); expect(router.state.location.pathname).toBe("/grade");
  fireEvent.click(screen.getByText("Menu khác")); fireEvent.click(await screen.findByText("Bỏ thay đổi và tiếp tục"));
  await waitFor(() => expect(router.state.location.pathname).toBe("/after"));
});
it.each([[-1, "/before"], [1, "/after"]])("guards history movement %s", async (direction, target) => {
  const router = mountEditor(); fireEvent.change(screen.getByLabelText("Điểm"), { target: { value: "7" } });
  await act(async () => { await router.navigate(direction); });
  fireEvent.click(await screen.findByText("Ở lại")); expect(router.state.location.pathname).toBe("/grade"); expect(screen.getByLabelText("Điểm")).toHaveValue("7");
  await act(async () => { await router.navigate(direction); }); fireEvent.click(await screen.findByText("Bỏ thay đổi và tiếp tục"));
  await waitFor(() => expect(router.state.location.pathname).toBe(target));
});
it.each(["unchanged", "restored", "saved"])("allows navigation when values are %s", async state => {
  const router = mountEditor();
  if (state !== "unchanged") fireEvent.change(screen.getByLabelText("Điểm"), { target: { value: "7" } });
  if (state === "restored") fireEvent.change(screen.getByLabelText("Điểm"), { target: { value: "6.0" } });
  if (state === "saved") fireEvent.click(screen.getByText("Lưu"));
  fireEvent.click(screen.getByText("Menu khác")); await waitFor(() => expect(router.state.location.pathname).toBe("/after")); expect(screen.queryByRole("dialog")).toBeNull();
});
it("does not guard a display-only change or silently clear its dirty values", async () => {
  mountEditor(); fireEvent.change(screen.getByLabelText("Điểm"), { target: { value: "7" } }); fireEvent.click(screen.getByText("Đổi hiển thị"));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByLabelText("Điểm")).toHaveValue("7");
  fireEvent.click(screen.getByText("Menu khác")); expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
it("compares real payload values, including raw precision and notes", () => {
  const saved = baseline(); expect(hasGradeChanges(saved, updateGradeDraft(saved, { testScore: "6.00" }))).toBe(false);
  expect(hasGradeChanges(saved, updateGradeDraft(saved, { testScore: "6.01" }))).toBe(true);
  expect(hasGradeChanges(saved, { ...saved, notes: "New note" })).toBe(true);
});
it("uses the same light Toast host and produces one toast per operation", async () => {
  toast.dismiss(); toast.clearWaitingQueue(); const view = render(<AppToaster />);
  act(() => { toast.success("Saved"); toast.error("Rejected"); toast.warning("Warning"); });
  await screen.findByText("Warning"); expect(document.querySelectorAll('.Toastify__toast')).toHaveLength(3);
  for (const el of document.querySelectorAll('.Toastify__toast')) { expect(el).toHaveClass('app-toast', 'Toastify__toast-theme--light'); }
  expect(document.querySelector('.Toastify__toast-container')).toHaveClass('Toastify__toast-container--top-right');
  toast.dismiss(); view.unmount();
});
