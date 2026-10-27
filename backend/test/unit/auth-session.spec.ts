import { AuthService } from "../../src/auth/auth.service.js";
import { SessionSerializer } from "../../src/auth/session.serializer.js";
import { Staff } from "../../src/database/models/staff.model.js";

describe("Staff session deserialization", () => {
  const build = () => {
    const staff = { findById: jest.fn() };
    const students = { findById: jest.fn() };
    const auth = new AuthService(staff as any, students as any, {} as any, {} as any);
    return { staff, students, auth, serializer: new SessionSerializer(auth) };
  };

  it("reloads the password-change flag on every request without replacing the session", async () => {
    const { staff, auth, serializer } = build();
    const forced = Object.defineProperties(Object.create(Staff.prototype), {
      id: { value: "s1" }, sessionVersion: { value: 4 },
    });
    const done = jest.fn();
    serializer.serializeUser(forced, done);
    expect(done).toHaveBeenCalledWith(null, "staff:s1:4");
    staff.findById.mockResolvedValueOnce({ status: "active", sessionVersion: 4, mustChangePassword: true })
      .mockResolvedValueOnce({ status: "active", sessionVersion: 4, mustChangePassword: false });
    expect(await auth.deserialize("staff:s1:4")).toMatchObject({ mustChangePassword: true });
    expect(await auth.deserialize("staff:s1:4")).toMatchObject({ mustChangePassword: false });
    expect(staff.findById).toHaveBeenCalledTimes(2);
  });

  it("still rejects revoked or disabled Staff sessions", async () => {
    const { staff, auth } = build();
    staff.findById.mockResolvedValueOnce({ status: "active", sessionVersion: 5 })
      .mockResolvedValueOnce({ status: "disabled", sessionVersion: 4 });
    expect(await auth.deserialize("staff:s1:4")).toBeNull();
    expect(await auth.deserialize("staff:s1:4")).toBeNull();
  });

  it("keeps Student session lookup independent of the Staff policy", async () => {
    const { staff, students, serializer } = build();
    const student = { id: "learner", accountType: "registered", approvalState: "approved", sessionVersion: 2 };
    students.findById.mockResolvedValue(student);
    const done = jest.fn();
    await serializer.deserializeUser("student:learner:2", done);
    expect(done).toHaveBeenCalledWith(null, student);
    expect(staff.findById).not.toHaveBeenCalled();
  });

  it("rejects legacy, malformed and unknown session types", async () => {
    const { auth, staff, students } = build();
    for (const key of ["staff:s1", "student:s1", "other:s1:0", "staff:s1:NaN", "staff:s1:0:extra"]) {
      expect(await auth.deserialize(key)).toBeNull();
    }
    expect(staff.findById).not.toHaveBeenCalled();
    expect(students.findById).not.toHaveBeenCalled();
  });

  it("rejects revoked Student sessions and accounts no longer approved", async () => {
    const { auth, students } = build();
    students.findById.mockResolvedValue({ accountType: "registered", approvalState: "approved", sessionVersion: 3 });
    expect(await auth.deserialize("student:learner:2")).toBeNull();
    students.findById.mockResolvedValue({ accountType: "prospective", approvalState: "approved", sessionVersion: 2 });
    expect(await auth.deserialize("student:learner:2")).toBeNull();
    students.findById.mockResolvedValue({ accountType: "registered", approvalState: "not approved", sessionVersion: 2 });
    expect(await auth.deserialize("student:learner:2")).toBeNull();
  });
});
