import { fireEvent, render, screen } from "@testing-library/react";
import SubjectIdentityFields, {
  buildSubjectIdentityPayload,
  filterSubjectRootCandidates,
  normalizeSubjectIdentity,
  setSubjectCanonicalRoot,
  setSubjectRootEnabled,
} from "../../components/SubjectIdentityFields";

const root = {
  id: "root-1",
  codeText: "ROOT-1",
  name: "Học phần gốc từ API",
  program: "masters",
  active: true,
  allowCrossMajor: true,
  canonicalSubjectId: null,
  major: { code: "CNTT", name: "Công nghệ thông tin" },
};

const alias = {
  id: "alias-1",
  codeText: "ALIAS-1",
  name: "Học phần ngành hiện tại",
  program: "masters",
};

const renderFields = (identity, onChange = jest.fn(), subjects = [root]) => {
  render(
    <SubjectIdentityFields
      subject={alias}
      identity={identity}
      onChange={onChange}
      program="masters"
      subjects={subjects}
    />,
  );
  return onChange;
};

describe("Subject cross-major identity fields", () => {
  it("maps the root toggle to allowCrossMajor=true and canonicalSubjectId=null", () => {
    const onChange = renderFields({ allowCrossMajor: false, canonicalSubjectId: null });

    fireEvent.click(screen.getByRole("checkbox", { name: "Cho phép ghép lớp khác ngành" }));

    expect(onChange).toHaveBeenCalledWith({ allowCrossMajor: true, canonicalSubjectId: null });
  });

  it("maps an alias selection to canonicalSubjectId and disables root state", () => {
    const onChange = renderFields({ allowCrossMajor: false, canonicalSubjectId: null });

    fireEvent.mouseDown(screen.getByLabelText("Học phần chung tương ứng"));
    fireEvent.click(screen.getByRole("option", { name: /ROOT-1 · Học phần gốc từ API/ }));

    expect(onChange).toHaveBeenCalledWith({ allowCrossMajor: false, canonicalSubjectId: root.id });
  });

  it("cannot construct a simultaneous alias and root state through UI transitions", () => {
    expect(setSubjectRootEnabled(true)).toEqual({ allowCrossMajor: true, canonicalSubjectId: null });
    expect(setSubjectCanonicalRoot(root.id)).toEqual({ allowCrossMajor: false, canonicalSubjectId: root.id });
    expect(buildSubjectIdentityPayload({ allowCrossMajor: true, canonicalSubjectId: root.id }))
      .toEqual({ allowCrossMajor: false, canonicalSubjectId: root.id });
  });

  it("loads an existing Subject mapping into the edit state", () => {
    expect(normalizeSubjectIdentity({ ...alias, allowCrossMajor: false, canonicalSubjectId: root.id }))
      .toEqual({ allowCrossMajor: false, canonicalSubjectId: root.id });
    expect(normalizeSubjectIdentity({ ...root }))
      .toEqual({ allowCrossMajor: true, canonicalSubjectId: null });
  });

  it("clears an alias mapping with an explicit null payload", () => {
    expect(setSubjectCanonicalRoot(""))
      .toEqual({ allowCrossMajor: false, canonicalSubjectId: null });
  });

  it("keeps only valid backend-provided root candidates", () => {
    const candidates = filterSubjectRootCandidates([
      root,
      { ...root, id: alias.id },
      { ...root, id: "inactive", active: false },
      { ...root, id: "doctoral", program: "doctoral" },
      { ...root, id: "not-enabled", allowCrossMajor: false },
      { ...root, id: "alias-root", canonicalSubjectId: "another-root" },
    ], alias.id, "masters");

    expect(candidates).toEqual([root]);
  });

  it("renders arbitrary real candidates instead of a hard-coded common-subject catalog", () => {
    const apiRoot = { ...root, id: "api-only", codeText: "API-987", name: "Tên do backend trả về" };
    renderFields({ allowCrossMajor: false, canonicalSubjectId: null }, jest.fn(), [apiRoot]);

    fireEvent.mouseDown(screen.getByLabelText("Học phần chung tương ứng"));

    expect(screen.getByRole("option", { name: /API-987 · Tên do backend trả về/ })).toBeInTheDocument();
  });

  it("shows the explicit CourseOffering/Scheduling consequence for an alias", () => {
    renderFields({ allowCrossMajor: false, canonicalSubjectId: root.id });

    expect(screen.getByText(/sẽ được xem là cùng học phần logic với/)).toBeInTheDocument();
    expect(screen.getByText(/Tạo lớp học phần \/ Xếp lịch/)).toBeInTheDocument();
  });
});
