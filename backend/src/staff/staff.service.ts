import { Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { StaffRepository } from "./staff.repository.js";
import { serializeStaff } from "./staff.serializer.js";

@Injectable()
export class StaffService {
  constructor(
    private readonly repository: StaffRepository,
  ) {}

  async profile(id: string) {
    const staff = await this.repository.findById(id);
    if (!staff) throw new NotFoundException("Không tìm thấy người dùng");
    return serializeStaff(staff);
  }

  async studentsToReview(id: string) {
    const staff = await this.repository.findWithStudents(id);
    if (!staff) throw new NotFoundException("Không tìm thấy người dùng");
    return {
      status: "success",
      usersWithRelevantNames: staff.students.map((student) => ({ _id: student.id, fullName: student.fullName, supervisorId: staff.id })),
    };
  }

  async seedAdmin(name: string, email: string, password: string) {
    const hashed = await bcrypt.hash(password, 12);
    const existing = await this.repository.findByEmail(email);
    if (existing) {
      await existing.update({ role: "admin", name, password: hashed });
      return { action: "updated", email: existing.email };
    }
    const admin = await this.repository.create({ name, email: email.toLowerCase(), password: hashed, role: "admin" });
    return { action: "created", email: admin.email };
  }
}
