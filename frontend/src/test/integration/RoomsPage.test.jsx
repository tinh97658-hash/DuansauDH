import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import Rooms from "../../pages/system/rooms";

jest.mock("@mui/icons-material", () => ({
  AddRounded: () => null, EditRounded: () => null, SearchRounded: () => null,
}));
const renderPage = async () => {
  await act(async () => { render(<MemoryRouter><Rooms /></MemoryRouter>); });
};
const clickAndWait = async (element) => { await act(async () => { fireEvent.click(element); }); };

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {}, interceptors: { request: { use: jest.fn() } } }));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) { return children; });

const room = { id: "room-1", code: "301", name: "Phòng 301", capacity: null, isActive: false };

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
    await renderPage();
    expect(await screen.findByText("301")).toBeInTheDocument();
    expect(screen.getByText("Chưa khai báo")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Ngừng sử dụng")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/system/rooms?includeInactive=true"), { withCredentials: true });
    expect(screen.queryByRole("button", { name: /xóa/i })).not.toBeInTheDocument();
  });

  it("creates a room using the existing POST contract", async () => {
    await renderPage();
    await clickAndWait(await screen.findByRole("button", { name: "Thêm phòng" }));
    fireEvent.change(screen.getByLabelText("Mã phòng"), { target: { value: "302" } });
    fireEvent.change(screen.getByLabelText("Tên phòng"), { target: { value: "Phòng 302" } });
    fireEvent.change(screen.getByLabelText("Sức chứa"), { target: { value: "45" } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/system/rooms"), { code: "302", name: "Phòng 302", capacity: 45, isActive: true }, { withCredentials: true }));
  });

  it("reactivates without deleting the persisted room", async () => {
    await renderPage();
    await clickAndWait(await screen.findByRole("checkbox", { name: "Kích hoạt phòng 301" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/system/rooms/room-1"), { isActive: true }, { withCredentials: true }));
    expect(axios.delete).toBeUndefined();
  });
});
