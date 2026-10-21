import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Staff } from "../../src/database/models/staff.model.js";
import { ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";

const build = (permissions: string[]) => {
  const actor = Object.create(Staff.prototype);
  const offering: any = { id: "o", status: "completed", gradebookStatus: "draft", gradebookVersion: 0, subject: { program: "masters" } };
  const offerings = { findByPk: jest.fn().mockResolvedValue(offering) };
  const groups = { findOne: jest.fn().mockResolvedValue({ id: "g" }) };
  const books = { findAll: jest.fn().mockResolvedValue([]) };
  const sequelize: any = { query: jest.fn().mockResolvedValue([]), transaction: jest.fn((fn: any) => fn({ LOCK: { UPDATE: "UPDATE" } })) };
  const rbac: any = { effectiveAccess: jest.fn().mockResolvedValue({ permissions: new Set(permissions) }) };
  const service = new ExamGradebookService(groups as any, {} as any, offerings as any, { findOne: jest.fn().mockResolvedValue({}) } as any, books as any, sequelize, undefined, rbac);
  return { service, actor, offering, offerings, books, sequelize };
};
const body: any = { classGroupId: "g", courseOfferingId: "o", revision: 0, version: 0, note: "QA reason" };

describe("Workflow service defense in depth", () => {
  for (const permissions of [[], ["gradebook.submit"], ["gradebook.approve"], ["gradebook.submit", "gradebook.approve"]]) {
    it.each(["submit", "approve", "reopen"])(`${permissions.join("+") || "none"}: direct %s checks action ownership`, async action => {
      const { service, actor, offerings, sequelize } = build(permissions);
      offerings.findByPk.mockResolvedValue(null);
      const allowed = permissions.includes(action === "submit" ? "gradebook.submit" : "gradebook.approve");
      await expect(service.transition({ ...body, action }, actor)).rejects.toThrow(allowed ? NotFoundException : ForbiddenException);
      expect(sequelize.transaction).toHaveBeenCalledTimes(allowed ? 1 : 0);
    });
  }
  it("does not trust a plain object claiming an admin role", async () => {
    const { service, sequelize } = build(["gradebook.approve"]);
    await expect(service.transition({ ...body, action: "approve" }, { role: "admin" })).rejects.toThrow(ForbiddenException);
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
  it("still requires an explicit reason after authorization", async () => {
    const { service, actor, sequelize } = build(["gradebook.approve"]);
    await expect(service.transition({ ...body, action: "reopen", note: " " }, actor)).rejects.toThrow(BadRequestException);
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
  it("still requires teaching completion", async () => {
    const { service, actor, offering } = build(["gradebook.approve"]);
    offering.status = "active";
    await expect(service.transition({ ...body, action: "approve" }, actor)).rejects.toThrow(ConflictException);
  });
  it("still checks workflow version before transitions", async () => {
    const { service, actor, offering } = build(["gradebook.approve"]);
    offering.gradebookVersion = 2;
    await expect(service.transition({ ...body, action: "reopen" }, actor)).rejects.toThrow("Trạng thái bảng điểm đã thay đổi");
  });
  it("still rejects reopening a draft", async () => {
    const { service, actor } = build(["gradebook.approve"]);
    await expect(service.transition({ ...body, action: "reopen" }, actor)).rejects.toThrow("không phù hợp trạng thái");
  });
  it("still checks the grade revision", async () => {
    const { service, actor, offering, books } = build(["gradebook.approve"]);
    offering.gradebookStatus = "submitted";
    books.findAll.mockResolvedValue([{ revision: 2 }]);
    await expect(service.transition({ ...body, action: "approve" }, actor)).rejects.toThrow("Điểm đã thay đổi");
  });
  it("still rejects submission of an incomplete gradebook", async () => {
    const { service, actor } = build(["gradebook.submit"]);
    jest.spyOn(service, "get").mockResolvedValue({ rows: [], pageSize: 15, total: 0 } as any);
    await expect(service.transition({ ...body, action: "submit" }, actor)).rejects.toThrow("đủ kết quả");
  });
  it("still compares approval against the submitted snapshot", async () => {
    const { service, actor, offering } = build(["gradebook.approve"]);
    offering.gradebookStatus = "submitted";
    offering.gradebookSnapshot = { rows: [] };
    jest.spyOn(service, "get").mockResolvedValue({ rows: [{ participantId: "changed", result: "passed" }], pageSize: 15, total: 1 } as any);
    await expect(service.transition({ ...body, action: "approve" }, actor)).rejects.toThrow("đã thay đổi sau khi gửi duyệt");
  });
});
