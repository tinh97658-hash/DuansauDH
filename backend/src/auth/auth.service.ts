import { Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { StaffRepository } from "../staff/staff.repository.js";
import { StudentsRepository } from "../students/students.repository.js";

@Injectable()
export class AuthService {
  constructor(private readonly staff: StaffRepository, private readonly students: StudentsRepository) {}

  async validateLocal(email: string, password: string) {
    const staff = await this.staff.findByEmail(email);
    if (staff) {
      if (!staff.password) throw new UnauthorizedException("Tài khoản cán bộ này yêu cầu đăng nhập bằng Google");
      if (await bcrypt.compare(password, staff.password)) return staff;
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }
    const student = await this.students.findByEmail(email);
    if (!student || student.accountType !== "registered" || student.approvalState !== "approved") {
      throw new UnauthorizedException("Không tìm thấy tài khoản nội bộ hợp lệ với email này");
    }
    if (await bcrypt.compare(password, student.password)) return student;
    throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
  }

  async validateGoogle(email: string) {
    const staff = await this.staff.findByEmail(email);
    if (!staff) throw new UnauthorizedException("Tài khoản cán bộ chưa được cấp quyền sử dụng hệ thống");
    return staff;
  }

  async deserialize(key: string) {
    const [type, id] = String(key).split(":");
    return type === "staff" ? this.staff.findById(id) : this.students.findById(id);
  }
}
