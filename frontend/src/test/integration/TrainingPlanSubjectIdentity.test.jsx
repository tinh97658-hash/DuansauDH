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

const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin", program: "masters", disciplineId: "discipline-1" };
const otherMajor = { id: "major-2", code: "QTKD", name: "Quản trị kinh doanh", program: "masters", disciplineId: "discipline-1" };
const thirdMajor = { id: "major-3", code: "KTHH", name: "Khai thác hàng hải", program: "masters", disciplineId: "discipline-2" };
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

const configureReads = (
  localSubjects,
  availableMajors = [major, otherMajor],
  availableSubjects = [root, ...localSubjects],
) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/auth/isStaff")) return Promise.resolve({ data: { message: "admin" } });
    if (url.includes("/plan/training-plan")) return Promise.resolve({ data: availableMajors });
    if (url.includes("/plan/subjects?majorId=")) return Promise.resolve({ data: localSubjects });
    if (url.includes("/plan/subjects?program=")) return Promise.resolve({ data: availableSubjects });
    if (url.includes("/plan/classes")) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
};

describe("Training Plan Subject identity persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("đóng và mở lại học phần bằng trạng thái, không có thao tác xóa", async () => {
    const subject = { ...root, majorId: major.id };
    configureReads([subject]);
    axios.put.mockResolvedValueOnce({ data: { ...subject, active: false } })
      .mockResolvedValueOnce({ data: { ...subject, active: true } });
    await act(async () => { render(<TrainingPlan />); });
    const toggle = await screen.findByRole("checkbox", { name: `Mở/Đóng học phần ${subject.name}` });
    expect(toggle).toBeChecked();
    expect(screen.queryByRole("button", { name: "Xóa" })).not.toBeInTheDocument();
    await clickAndWait(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(screen.getByText(subject.name)).toBeInTheDocument();
    expect(axios.put).toHaveBeenLastCalledWith(expect.stringContaining(`/plan/subjects/${subject.id}`), { active: false }, { withCredentials: true });
    await clickAndWait(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(axios.put).toHaveBeenLastCalledWith(expect.stringContaining(`/plan/subjects/${subject.id}`), { active: true }, { withCredentials: true });
    expect(axios.delete).not.toHaveBeenCalled();
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
    await waitFor(() => expect(screen.queryByRole("option", { name: /QTKD — Quản trị kinh doanh/ })).not.toBeInTheDocument());
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

  it("does not suggest while typing and asks only after saving an exact name and credit match", async () => {
    configureReads([]);
    axios.post.mockResolvedValue({ data: { ...root, id: "created-separate", majorId: major.id } });
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));

    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), {
      target: { value: root.name.slice(0, 3) },
    });
    const nameInput = screen.getByPlaceholderText("Nhập tên học phần...");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /ROOT-1/ })).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: root.name } });
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "401" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "LOCAL-401" } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));
    expect(await screen.findByText(/ghép học chung học phần này/)).toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Không" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/plan\/subjects$/),
      expect.objectContaining({ name: root.name, sharedMajorIds: [] }),
      { withCredentials: true },
    ));
  });

  it("saves normally when the name matches but the credit count is different", async () => {
    const differentCreditSubject = { ...root, credits: 4 };
    configureReads([], [major, otherMajor], [differentCreditSubject]);
    axios.post.mockResolvedValue({ data: { ...root, id: "created-different-credit", majorId: major.id } });
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));

    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "406" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "LOCAL-406" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: root.name } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));

    expect(screen.queryByText(/ghép học chung học phần này/)).not.toBeInTheDocument();
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/plan\/subjects$/),
      expect.objectContaining({ name: root.name, credits: 3 }),
      { withCredentials: true },
    ));
  });

  it("capitalizes the first character of a new subject name", async () => {
    configureReads([]);
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));

    const nameInput = screen.getByPlaceholderText("Nhập tên học phần...");
    fireEvent.change(nameInput, { target: { value: "xử lý ảnh nâng cao" } });
    expect(nameInput).toHaveValue("Xử lý ảnh nâng cao");
  });

  it("links the selected existing subject when shared learning is accepted", async () => {
    configureReads([]);
    const created = { ...root, id: "created-linked", majorId: major.id, sharedMajorIds: [otherMajor.id] };
    axios.post.mockResolvedValue({ data: { subject: created, linkedSubjects: [{ ...root, sharedMajorIds: [major.id] }] } });
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "402" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "LOCAL-402" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: root.name } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));
    await clickAndWait(await screen.findByRole("button", { name: "Có" }));
    expect(screen.getByText("Chọn tất cả")).toBeInTheDocument();
    expect(screen.getByLabelText(/QTKD —/)).toBeChecked();
    await clickAndWait(screen.getByRole("button", { name: "Xác nhận học chung" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects/link-existing"),
      expect.objectContaining({
        source: expect.objectContaining({ name: root.name }),
        existingSubjectIds: [root.id],
      }),
      { withCredentials: true },
    ));
  });

  it("does not show name suggestions while editing an existing subject", async () => {
    const local = {
      ...root,
      id: "local-edit",
      majorId: major.id,
      major,
      name: "Môn đang sửa",
      allowCrossMajor: false,
      sharedMajorIds: [],
    };
    configureReads([local]);
    await act(async () => { render(<TrainingPlan />); });
    fireEvent.doubleClick(await screen.findByText(local.name));

    const nameInput = screen.getByPlaceholderText("Tên học phần...");
    fireEvent.change(nameInput, { target: { value: root.name.slice(0, 3) } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /ROOT-1/ })).not.toBeInTheDocument();
    expect(nameInput).toHaveValue(root.name.slice(0, 3));
  });

  it("shows every eligible major and requests codes for majors without the subject", async () => {
    configureReads([], [major, otherMajor, thirdMajor]);
    const created = { ...root, id: "created-all-majors", majorId: major.id, sharedMajorIds: [otherMajor.id, thirdMajor.id] };
    axios.post.mockResolvedValue({ data: {
      subject: created,
      linkedSubjects: [{ ...root, sharedMajorIds: [major.id, thirdMajor.id] }],
      createdCounterparts: [{ ...root, id: "third-copy", majorId: thirdMajor.id, codeNumber: 501, codeText: "KTHH-501" }],
    } });
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "403" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "LOCAL-403" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: root.name } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));
    await clickAndWait(await screen.findByRole("button", { name: "Có" }));

    expect(screen.getByLabelText(/QTKD —/)).toBeChecked();
    expect(screen.getByLabelText(/KTHH —/)).not.toBeChecked();
    await clickAndWait(screen.getByLabelText(/KTHH —/));
    await clickAndWait(screen.getByRole("button", { name: "Xác nhận học chung" }));

    const numberInputs = await screen.findAllByLabelText("Mã số");
    const textInputs = screen.getAllByLabelText("Mã chữ");
    fireEvent.change(numberInputs[1], { target: { value: "501" } });
    fireEvent.change(textInputs[1], { target: { value: "KTHH-501" } });
    await clickAndWait(screen.getByRole("button", { name: "Tạo cho tất cả chuyên ngành" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/plan/subjects/link-existing"),
      expect.objectContaining({
        existingSubjectIds: [root.id],
        counterparts: [{ majorId: thirdMajor.id, codeNumber: 501, codeText: "KTHH-501" }],
      }),
      { withCredentials: true },
    ));
  });

  it("drops stale major ids before saving an edited subject", async () => {
    const local = {
      ...root,
      id: "local-stale-scope",
      majorId: major.id,
      major,
      name: "Môn có phạm vi cũ",
      sharedMajorIds: ["00000000-0000-4000-8000-000000000999"],
      allowCrossMajor: true,
    };
    configureReads([local]);
    axios.put.mockResolvedValue({ data: { ...local, sharedMajorIds: [], allowCrossMajor: false } });
    await act(async () => { render(<TrainingPlan />); });
    fireEvent.doubleClick(await screen.findByText(local.name));
    await clickAndWait(screen.getByRole("button", { name: "Lưu (Enter)" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining(`/plan/subjects/${local.id}`),
      expect.objectContaining({ sharedMajorIds: [], allowCrossMajor: false }),
      { withCredentials: true },
    ));
  });

  it("detects an exact saved match from a different discipline without suggesting while typing", async () => {
    const crossDisciplineSubject = { ...root, id: "cross-discipline", majorId: major.id, major };
    configureReads([], [thirdMajor, major, otherMajor], [crossDisciplineSubject]);
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "404" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "CROSS-404" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), {
      target: { value: crossDisciplineSubject.name },
    });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /ROOT-1/ })).not.toBeInTheDocument();
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));
    expect(await screen.findByRole("button", { name: "Không" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Có" })).toBeInTheDocument();
  });

  it("closes the sharing prompt without discarding the draft", async () => {
    configureReads([]);
    await act(async () => { render(<TrainingPlan />); });
    await clickAndWait(await screen.findByRole("button", { name: "Thêm dòng mới" }));
    fireEvent.change(screen.getByPlaceholderText("Mã số (101)"), { target: { value: "405" } });
    fireEvent.change(screen.getByPlaceholderText("Mã chữ (CS01)"), { target: { value: "CLOSE-405" } });
    fireEvent.change(screen.getByPlaceholderText("Nhập tên học phần..."), { target: { value: root.name } });
    await clickAndWait(screen.getByRole("button", { name: "Lưu & Thêm tiếp (Enter)" }));
    await clickAndWait(await screen.findByRole("button", { name: "Đóng lựa chọn học chung" }));

    await waitFor(() => expect(screen.queryByText(/ghép học chung học phần này/)).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText("Mã số (101)")).toHaveValue(405);
    expect(screen.getByPlaceholderText("Mã chữ (CS01)")).toHaveValue("CLOSE-405");
    expect(screen.getByPlaceholderText("Nhập tên học phần...")).toHaveValue(root.name);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
