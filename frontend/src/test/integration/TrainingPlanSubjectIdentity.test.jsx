import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import TrainingPlan from "../../pages/plan/trainingPlan";
import { toast } from "react-toastify";

// Decorative icons are not the identity contract under test; avoid importing the full icon catalog.
jest.mock("@mui/icons-material", () => ({
  AddRounded: () => null, CheckBoxOutlineBlankRounded: () => null, CheckBoxRounded: () => null,
  CheckRounded: () => null, CloseRounded: () => null, DeleteOutlineRounded: () => null, DeleteRounded: () => null,
  EditRounded: () => null, LibraryBooksRounded: () => null, RefreshRounded: () => null,
  SaveRounded: () => null, SearchRounded: () => null, ClassRounded: () => null, PlaylistAddRounded: () => null,
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
  defaults: {},
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) { return children; });
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
  ToastContainer: () => null,
}));

const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin", program: "masters" };
const otherMajor = { id: "major-2", code: "QTKD", name: "Quản trị kinh doanh", program: "masters" };
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
    if (url.includes("/plan/training-plan")) return Promise.resolve({ data: [major, otherMajor] });
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

  it("keeps the old panel hidden and creates a regular subject when sharing is unchecked", async () => {
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

    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "201" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "NEW-ROOT" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: "Học phần gốc mới" } });
    expect(screen.queryByText("Học phần dùng chung giữa các ngành")).not.toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects"),
      expect.objectContaining({ allowCrossMajor: false, canonicalSubjectId: null }),
      { withCredentials: true },
    ));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.put).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByPlaceholderText("Mã số (101)")).toHaveValue(null));
  });

  it("clears an old subject reference without inventing a major scope", async () => {
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
    axios.put.mockResolvedValue({ data: mappedAlias });

    await act(async () => {
      render(<TrainingPlan />);
    });

    fireEvent.doubleClick(await screen.findByText(mappedAlias.name));
    expect(screen.queryByText("Học phần dùng chung giữa các ngành")).not.toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Lưu (Enter)" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining(`/plan/subjects/${mappedAlias.id}`),
      expect.objectContaining({ allowCrossMajor: false, canonicalSubjectId: null, sharedMajorIds: [] }),
      { withCredentials: true },
    ));
    await waitFor(() => expect(screen.queryByText("Học phần dùng chung giữa các ngành")).not.toBeInTheDocument());
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("selects all eligible majors allowed to study a subject together", async () => {
    const local = { ...root, id: "local", majorId: major.id, allowCrossMajor: false, sharedMajorIds: [], name: "Triết học" };
    configureReads([local]);
    axios.put.mockResolvedValue({ data: { ...local, allowCrossMajor: true, sharedMajorIds: [otherMajor.id] } });
    await act(async () => { render(<TrainingPlan />); });

    fireEvent.mouseDown(await screen.findByLabelText("Phạm vi học chung: Triết học"));
    await clickAndWait(screen.getByRole("option", { name: /Chọn tất cả/ }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects/local"),
      { allowCrossMajor: true, canonicalSubjectId: null, sharedMajorIds: [otherMajor.id] },
      { withCredentials: true },
    ));
  });

  it("removes an old reference and toggles sharing without opening a chooser", async () => {
    const local = { ...root, id: "local", majorId: major.id, allowCrossMajor: true, canonicalSubjectId: root.id, sharedMajorIds: [otherMajor.id] };
    configureReads([local]);
    axios.put.mockResolvedValueOnce({ data: { ...local, canonicalSubjectId: null, allowCrossMajor: false, sharedMajorIds: [] } });
    await act(async () => { render(<TrainingPlan />); });

    fireEvent.mouseDown(await screen.findByLabelText(`Phạm vi học chung: ${local.name}`));
    await clickAndWait(screen.getByRole("option", { name: /QTKD — Quản trị kinh doanh/ }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects/local"),
      { allowCrossMajor: false, canonicalSubjectId: null, sharedMajorIds: [] },
      { withCredentials: true },
    ));
    axios.put.mockResolvedValueOnce({ data: { ...local, allowCrossMajor: true, canonicalSubjectId: null, sharedMajorIds: [otherMajor.id] } });
    fireEvent.mouseDown(screen.getByLabelText(`Phạm vi học chung: ${local.name}`));
    await clickAndWait(screen.getByRole("option", { name: /QTKD — Quản trị kinh doanh/ }));
    expect(axios.put).toHaveBeenLastCalledWith(
      expect.stringContaining("/plan/subjects/local"),
      { allowCrossMajor: true, canonicalSubjectId: null, sharedMajorIds: [otherMajor.id] },
      { withCredentials: true },
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the checkbox state when saving the change fails", async () => {
    const local = { ...root, majorId: major.id };
    configureReads([local]);
    axios.put.mockRejectedValue({ response: { data: { message: "Học phần đang được sử dụng" } } });
    await act(async () => { render(<TrainingPlan />); });
    fireEvent.mouseDown(await screen.findByLabelText(`Phạm vi học chung: ${local.name}`));
    await clickAndWait(screen.getByRole("option", { name: /QTKD — Quản trị kinh doanh/ }));
    expect(toast.error).toHaveBeenCalledWith("Học phần đang được sử dụng");
  });

  it("saves the automatic sharing flag together with a new draft", async () => {
    configureReads([]);
    axios.post.mockResolvedValue({ data: { subjects: [
      { ...root, id: "new-local", majorId: major.id, sharedMajorIds: [otherMajor.id] },
      { ...root, id: "new-other", majorId: otherMajor.id, codeNumber: 301, codeText: "OTHER", sharedMajorIds: [major.id] },
    ] } });
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "201" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "LOCAL" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: root.name } });
    fireEvent.mouseDown(screen.getByLabelText(`Phạm vi học chung: ${root.name}`));
    await clickAndWait(screen.getByRole("option", { name: /QTKD — Quản trị kinh doanh/ }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(axios.put).not.toHaveBeenCalled();
    await clickAndWait(await screen.findByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));
    const numberInputs = await screen.findAllByLabelText("Mã số");
    const textInputs = screen.getAllByLabelText("Mã chữ");
    fireEvent.change(numberInputs[1], { target: { value: "301" } });
    fireEvent.change(textInputs[1], { target: { value: "OTHER" } });
    await clickAndWait(screen.getByRole("button", { name: "Tạo cho tất cả chuyên ngành" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects/shared"),
      expect.objectContaining({
        source: expect.objectContaining({ codeText: "LOCAL", sharedMajorIds: [otherMajor.id] }),
        counterparts: [{ majorId: otherMajor.id, codeNumber: 301, codeText: "OTHER" }],
      }),
      { withCredentials: true },
    ));
  });
});
