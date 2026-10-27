import { renderWithPermissions } from "../renderWithPermissions";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import Rooms from "../../pages/system/rooms";

const render = (ui, options) => renderWithPermissions(ui, ["catalog.manage"], options);

jest.mock("@mui/icons-material", () => ({
  AddRounded: () => null, EditRounded: () => null, SearchRounded: () => null,
}));
const renderPage = async () => {
  await act(async () => { render(<MemoryRouter useTransitions={false}><Rooms /></MemoryRouter>); });
};
const clickAndWait = async (element) => { await act(async () => { fireEvent.click(element); }); };

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {} }));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) { return children; });

const room = { id: "room-1", code: "301", name: "Phòng 301", floor: "2", capacity: null, isActive: false };

describe("Room admin catalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes("/system/rooms")) return Promise.resolve({ data: [room] });
      if (url.includes("/auth/session")) return Promise.resolve({ data: { user: { role: "admin" } } });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    axios.post.mockResolvedValue({ data: {} });
    axios.put.mockResolvedValue({ data: {} });
  });

  it("loads inactive rooms through the admin includeInactive view and has no delete action", async () => {
    axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes("/system/rooms")
      ? [room, { ...room, id: "room-2", code: "302", name: "Phòng 302", isActive: true }]
      : { user: { role: "admin" } } }));
    await renderPage();
    expect(await screen.findByText("301")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa khai báo")).toHaveLength(2);
    expect(screen.getAllByRole("cell", { name: "2" })).toHaveLength(3);
    expect(screen.queryByText("Đang sử dụng")).not.toBeInTheDocument();
    expect(screen.queryByText("Ngừng sử dụng")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Trạng thái/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Kích hoạt phòng 301" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Vô hiệu hóa phòng 302" })).toBeChecked();
    await clickAndWait(screen.getByRole("checkbox", { name: "Kích hoạt phòng 301" }));
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/system/rooms/room-1"), { isActive: true }, { withCredentials: true });
    expect(screen.getByRole("checkbox", { name: "Vô hiệu hóa phòng 301" })).toBeChecked();
    expect(screen.getByRole("columnheader", { name: /Thao tác/ })).toHaveStyle({ textAlign: "center" });
   screen.getAllByRole("button", { name: "Sửa" }).forEach(button => expect(button.closest("td")).toHaveStyle({ textAlign: "center" }));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/system/rooms?includeInactive=true"), { withCredentials: true });
    expect(screen.queryByRole("button", { name: /xóa/i })).not.toBeInTheDocument();
  });

  it.each(["1", ""])("creates a room with optional floor %j", async (floor) => {
    await renderPage();
    await clickAndWait(await screen.findByRole("button", { name: "Thêm phòng" }));
    fireEvent.change(screen.getByLabelText("Mã phòng"), { target: { value: "A61P01" } });
    fireEvent.change(screen.getByLabelText("Tên phòng"), { target: { value: "Phòng 1" } });
    expect(screen.getByLabelText("Tầng")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Tầng"), { target: { value: floor } });
    fireEvent.change(screen.getByLabelText("Sức chứa"), { target: { value: "45" } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/system/rooms"), { code: "A61P01", name: "Phòng 1", floor: floor || null, capacity: 45, isActive: true }, { withCredentials: true }));
  });

  it("uses the shared ordinary read for catalog.view without exposing write controls", async () => {
    axios.get.mockResolvedValue({ data: [{ ...room, isActive: true }] });
    await act(async () => { renderWithPermissions(<MemoryRouter useTransitions={false}><Rooms /></MemoryRouter>, ["catalog.view"]); });
    expect(await screen.findByText("301")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/system\/rooms$/), { withCredentials: true });
    expect(axios.get.mock.calls.some(([url]) => url.includes("includeInactive"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Thêm phòng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByText("Phòng 301"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens editing on double click and preserves the status when saving", async () => {
    await renderPage();
    await act(async () => { fireEvent.doubleClick(await screen.findByText("Phòng 301")); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên phòng")).toHaveValue("Phòng 301");
    expect(screen.getByLabelText("Tầng")).toHaveValue("2");
    fireEvent.change(screen.getByLabelText("Tầng"), { target: { value: "3" } });
    expect(screen.getByText("Trạng thái hoạt động")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tên phòng"), { target: { value: "Phòng 301 mới" } });
    fireEvent.change(screen.getByLabelText("Sức chứa"), { target: { value: "45" } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/system/rooms/room-1"), { code: "301", name: "Phòng 301 mới", floor: "3", capacity: 45, isActive: false }, { withCredentials: true }));
    expect(axios.delete).toBeUndefined();
  });
});
