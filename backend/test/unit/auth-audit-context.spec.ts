import bcrypt from "bcrypt";
import { AuthService } from "../../src/auth/auth.service.js";
import { AuditContextService } from "../../src/audit/audit-context.js";
import { Staff } from "../../src/database/models/staff.model.js";

describe("Verified login audit identity", () => {
  const build = async () => {
    const context = new AuditContextService({});
    const staff = Object.defineProperties(Object.create(Staff.prototype), {
      id: { value: "staff" }, email: { value: "staff@example.invalid" }, status: { value: "active" },
      password: { value: await bcrypt.hash("test-only-password", 4) },
    });
    const update = jest.fn(async () => {
      expect(context.current()).toMatchObject({ actorStaffId: staff.id, actorEmail: staff.email, requestId: "QA-LOGIN" });
    });
    Object.defineProperty(staff, "update", { value: update });
    const repository: any = { findByEmail: jest.fn().mockResolvedValue(staff) };
    const audit: any = { record: jest.fn() };
    const service = new AuthService(repository, {} as any, audit, context);
    const request = { actorStaffId: null, actorEmail: null, requestId: "QA-LOGIN", ip: "127.0.0.1", userAgent: "login-test" };
    return { context, staff, update, audit, service, request };
  };
  it("attributes local last-login writes only after a successful password comparison", async () => {
    const { context, staff, update, audit, service, request } = await build();
    await expect(context.run(request, () => service.validateLocal(staff.email, "wrong"))).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    await expect(context.run(request, () => service.validateLocal(staff.email, "test-only-password"))).resolves.toBe(staff);
    expect(update).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.login", actorStaffId: staff.id, targetStaffId: staff.id }));
    expect(request.actorStaffId).toBeNull();
    expect(context.current()).toBeUndefined();
  });
  it("uses the accepted Staff identity for Google last-login writes and keeps semantic audit", async () => {
    const { context, staff, update, audit, service, request } = await build();
    await expect(context.run(request, () => service.validateGoogle(staff.email))).resolves.toBe(staff);
    expect(update).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.login", metadata: { email: staff.email, provider: "google" } }));
  });
});
