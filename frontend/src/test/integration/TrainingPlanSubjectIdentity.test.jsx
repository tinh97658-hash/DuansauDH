import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import TrainingPlan from "../../pages/plan/trainingPlan";

// Decorative icons are not the identity contract under test; avoid importing the full icon catalog.
jest.mock("@mui/icons-material", () => ({
  AddRounded: () => null, CheckBoxOutlineBlankRounded: () => null, CheckBoxRounded: () => null,
  CheckRounded: () => null, CloseRounded: () => null, DeleteRounded: () => null,
  EditRounded: () => null, LibraryBooksRounded: () => null, RefreshRounded: () => null,
  SaveRounded: () => null, SearchRounded: () => null, ClassRounded: () => null,
  StarRounded: () => null, StarOutlineRounded: () => null,
}));
const clickAndWait = async (element) => {
  await act(async () => { fireEvent.click(element); await new Promise((resolve) => setTimeout(resolve, 0)); });
};
jest.setTimeout(15000);

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: {}, interceptors: { request: { use: jest.fn() } },
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) { return children; });

const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin", program: "masters" };
const root = {
  id: "root-1",
  codeNumber: 100,
  codeText: "ROOT-1",
  code: "ROOT-1",
  name: "Học phần gốc",
  majorId: "major-2",
  program: "masters",
  credits: 3,
  subjectType: "CS",
  isRequired: true,
  sortOrder: 1,
  active: true,
  allowCrossMajor: true,
  canonicalSubjectId: null,
  major: { id: "major-2", code: "QTKD", name: "Quản trị kinh doanh" },
};

const configureReads = (localSubjects) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/auth/isStaff")) return Promise.resolve({ data: { message: "admin" } });
    if (url.includes("/plan/training-plan")) return Promise.resolve({ data: [major] });
    if (url.includes("/plan/subjects?majorId=")) return Promise.resolve({ data: localSubjects });
    if (url.includes("/plan/subjects?program=")) return Promise.resolve({ data: [root, ...localSubjects] });
    if (url.includes("/plan/classes")) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

describe("Training Plan Subject identity persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the enabled root identity in one Subject create request", async () => {
    configureReads([]);
    const created = {
      ...root,
      id: "created-root",
      codeNumber: 201,
      codeText: "NEW-ROOT",
      name: "Học phần gốc mới",
      majorId: major.id,
      allowCrossMajor: false,
    };
    axios.post.mockResolvedValue({ data: { ...created, allowCrossMajor: true } });

    await act(async () => {
      render(<TrainingPlan />);
    });

    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới (Excel)" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "201" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "NEW-ROOT" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: "Học phần gốc mới" } });
    await clickAndWait(screen.getByRole("checkbox", { name: "Có thể ghép lớp" }));
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects"),
      expect.objectContaining({ allowCrossMajor: true, canonicalSubjectId: null }),
      { withCredentials: true },
    ));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.put).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByPlaceholderText("Mã số (101)")).toHaveValue(null));
    await waitFor(() => expect(screen.queryByLabelText("Đang tải học phần gốc")).not.toBeInTheDocument());
  });

  it("loads an existing alias and sends null when the admin clears its mapping", async () => {
    const mappedAlias = {
      ...root,
      id: "alias-1",
      codeNumber: 202,
      codeText: "LOCAL-1",
      name: "Học phần local",
      majorId: major.id,
      major,
      allowCrossMajor: false,
      canonicalSubjectId: root.id,
    };
    configureReads([mappedAlias]);
    axios.put.mockResolvedValue({ data: { ...mappedAlias, canonicalSubjectId: null } });

    await act(async () => {
      render(<TrainingPlan />);
    });

    fireEvent.doubleClick(await screen.findByText(mappedAlias.name));
    expect(await screen.findByText(/ROOT-1 · Học phần gốc · QTKD/)).toBeInTheDocument();
    const selector = await screen.findByLabelText("Học phần chung tương ứng");

    fireEvent.mouseDown(selector);
    await clickAndWait(screen.getByRole("option", { name: "Không ánh xạ tới học phần khác" }));
    await clickAndWait(screen.getByRole("button", { name: "Lưu (Enter)" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining(`/plan/subjects/${mappedAlias.id}`),
      expect.objectContaining({ allowCrossMajor: false, canonicalSubjectId: null }),
      { withCredentials: true },
    ));
    await waitFor(() => expect(screen.queryByText("Học phần dùng chung giữa các ngành")).not.toBeInTheDocument());
    await act(async () => {
      await Promise.resolve();
    });
  });
});
