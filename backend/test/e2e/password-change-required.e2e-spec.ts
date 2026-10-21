import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import bcrypt from "bcrypt";
import request from "supertest";
import { AccountsController } from "../../src/accounts/accounts.controller.js";
import { AccountsService } from "../../src/accounts/accounts.service.js";
import { RbacService } from "../../src/auth/rbac.service.js";
import { AuthenticatedGuard } from "../../src/common/authenticated.guard.js";
import { StudentGuard } from "../../src/common/student.guard.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";

@Controller("student-policy-test")
class StudentController {
  @Get() @UseGuards(AuthenticatedGuard, StudentGuard)
  read() { return { ok: true }; }
}

describe("Forced Staff password change over HTTP", () => {
  let app: INestApplication;
  let current: any;
  const list = jest.fn(() => ({ rows: [] }));
  const staff: any = { findByPk: jest.fn(async () => current) };
  const audit: any = { record: jest.fn() };
  const accounts = new AccountsService(staff, {} as any, {} as any, {} as any, audit, {} as any, {} as any, {} as any);
  const passwordChange = accounts.changeOwnPassword.bind(accounts);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccountsController, StudentController],
      providers: [
        { provide: AccountsService, useValue: { list, mePermissions: () => ({ permissions: [] }), changeOwnPassword: passwordChange } },
        { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions: new Set(current.role === "admin" ? ["account.view"] : []) }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = current;
      req.isAuthenticated = () => Boolean(current);
      next();
    });
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => { list.mockClear(); });

  const user = (role: string, forced: boolean) => Object.defineProperties(Object.create(Staff.prototype), {
    id: { value: "staff-test" }, role: { value: role }, mustChangePassword: { value: forced, writable: true },
    sessionVersion: { value: 7 },
  });

  it("blocks an admin with account.view before business operations execute", async () => {
    current = user("admin", true);
    const result = await request(app.getHttpServer()).get("/accounts").expect(403);
    expect(result.body.message).toContain("Bạn phải đổi mật khẩu");
    expect(list).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get("/accounts/me/permissions").expect(200);
    await request(app.getHttpServer()).post("/accounts/other/reset-password").send({}).expect(403);
  });

  it("allows the real password service and continues the same session after changing password", async () => {
    current = user("admin", true);
    Object.defineProperty(current, "password", { value: await bcrypt.hash("old-test-password", 4), writable: true });
    current.update = async (values: any) => Object.assign(current, values);
    await request(app.getHttpServer()).patch("/accounts/me/password")
      .send({ currentPassword: "old-test-password", newPassword: "new-test-password" }).expect(200);
    expect(current.mustChangePassword).toBe(false);
    expect(current.sessionVersion).toBe(7);
    expect(await bcrypt.compare("new-test-password", current.password)).toBe(true);
    await request(app.getHttpServer()).get("/accounts").expect(200);
  });

  it("preserves the normal missing-permission denial", async () => {
    current = user("supervisor", false);
    const result = await request(app.getHttpServer()).get("/accounts").expect(403);
    expect(result.body.message).toContain("Bạn không có quyền");
    expect(list).not.toHaveBeenCalled();
  });

  it("returns 401 for anonymous access", async () => {
    current = null;
    await request(app.getHttpServer()).get("/accounts").expect(401);
  });

  it("leaves authenticated student flows unaffected even with a similarly named flag", async () => {
    current = Object.defineProperty(Object.create(Student.prototype), "mustChangePassword", { value: true });
    await request(app.getHttpServer()).get("/student-policy-test").expect(200);
  });
});
