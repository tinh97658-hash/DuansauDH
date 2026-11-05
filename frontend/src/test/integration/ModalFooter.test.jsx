import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Modal } from "../../features/scheduling/shared";

it("provides a working footer close button when no actions are supplied", () => {
  const close = vi.fn();
  render(<Modal title="Danh sách lớp" onClose={close}><p>Nội dung</p></Modal>);
  const footer = document.querySelector(".v20-dialog-foot");
  fireEvent.click(within(footer).getByRole("button", { name: "Đóng" }));
  expect(close).toHaveBeenCalledTimes(1);
});

it("disables footer dismissal while saving", () => {
  const close = vi.fn();
  render(<Modal title="Danh sách lớp" busy onClose={close}><p>Nội dung</p></Modal>);
  const button = within(document.querySelector(".v20-dialog-foot")).getByRole("button", { name: "Đóng" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(close).not.toHaveBeenCalled();
});

it("keeps supplied actions without adding another dismiss button", () => {
  const close = vi.fn();
  render(<Modal title="Chỉnh sửa" onClose={close} actions={<button onClick={close}>Hủy</button>} />);
  const footer = document.querySelector(".v20-dialog-foot");
  expect(within(footer).getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(close).toHaveBeenCalledTimes(1);
});

it("leaves embedded action bars in control when the outer footer is explicitly hidden", () => {
  render(<Modal title="Chỉnh sửa" onClose={vi.fn()} actions={false}><button>Quay lại</button></Modal>);
  expect(document.querySelector(".v20-dialog-foot")).toBeNull();
});
