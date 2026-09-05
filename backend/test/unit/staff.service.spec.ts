import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import { StaffService } from "../../src/staff/staff.service.js";

const staffModel = (overrides: Record<string, unknown> = {}) => {
  const values: any = {
    id: "staff-1",
    name: "Quản trị viên",
    email: "admin@example.edu.vn",
    role: "admin",
    active: true,
    password: null,
    ...overrides,
  };
  return {
    ...values,
    get: jest.fn(() => ({ ...values })),
    update: jest.fn(async (payload: Record<string, unknown>) => {
      Object.assign(values, payload);
      return values;
    }),
  };
};

const buildService = () => {
  const repository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithPassword: jest.fn(),
    list: jest.fn(),
    countActiveAdmins: jest.fn(),
    create: jest.fn(),
  };
  const notifications = { notify: jest.fn() };
  return {
    service: new StaffService(repository as never, notifications as never),
    repository,
  };
};

describe("StaffService user management", () => {
  it("hashes an initial password and activates a newly-created account", async () => {
    const { service, repository } = buildService();
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockImplementation(async (input: any) => staffModel(input));

    await service.add({ name: "Giảng viên", email: "gv@example.edu.vn", role: "supervisor", password: "Password123!" });

    const created: any = repository.create.mock.calls[0][0];
    expect(created.active).toBe(true);
    expect(created.password).not.toBe("Password123!");
    await expect(bcrypt.compare("Password123!", created.password)).resolves.toBe(true);
  });

  it("does not allow the signed-in admin to demote their own account", async () => {
    const { service, repository } = buildService();
    repository.findByIdWithPassword.mockResolvedValue(staffModel());

    await expect(service.update("staff-1", { role: "supervisor" }, "staff-1"))
      .rejects.toThrow("không thể tự hạ quyền");
  });

  it("keeps at least one active administrator", async () => {
    const { service, repository } = buildService();
    repository.findByIdWithPassword.mockResolvedValue(staffModel());
    repository.countActiveAdmins.mockResolvedValue(0);

    await expect(service.update("staff-1", { active: false }, "another-admin"))
      .rejects.toThrow("ít nhất một quản trị viên");
  });

  it("checks the current password before changing a staff password", async () => {
    const { service, repository } = buildService();
    const currentHash = await bcrypt.hash("OldPassword123!", 4);
    const model: any = staffModel({ password: currentHash });
    repository.findByIdWithPassword.mockResolvedValue(model);

    await expect(service.updatePassword("staff-1", { passwordCurrent: "wrong", password: "NewPassword123!" }))
      .rejects.toThrow("Mật khẩu hiện tại không chính xác");

    await service.updatePassword("staff-1", { passwordCurrent: "OldPassword123!", password: "NewPassword123!" });
    expect(model.update).toHaveBeenCalledWith(expect.objectContaining({ password: expect.any(String) }));
  });

  it("does not overwrite a password that the seeded admin has already changed", async () => {
    const { service, repository } = buildService();
    const existing: any = staffModel({ password: "already-changed-hash" });
    repository.findByEmail.mockResolvedValue(existing);

    await service.seedAdmin("Quản trị viên", "admin@example.edu.vn", "ValueFromEnvironment123!");

    expect(existing.update).toHaveBeenCalledWith({ role: "admin", name: "Quản trị viên" });
  });
});
