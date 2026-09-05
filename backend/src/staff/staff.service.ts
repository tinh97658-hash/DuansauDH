import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { NotificationService } from "../notifications/notification.service.js";
import { AddStaffDto, UpdateStaffDto } from "./dto/staff.dto.js";
import { StaffRepository } from "./staff.repository.js";
import { serializeStaff } from "./staff.serializer.js";
import { UpdatePasswordDto } from "../students/dto/password.dto.js";

@Injectable()
export class StaffService {
  constructor(
    private readonly repository: StaffRepository,
    private readonly notifications: NotificationService,
  ) {}

  async add(input: AddStaffDto) {
    if (await this.repository.findByEmail(input.email)) throw new ConflictException("Người dùng đã tồn tại");
    const staff = await this.repository.create({
      ...input,
      password: input.password ? await bcrypt.hash(input.password, 12) : null,
      active: true,
    });
    this.notifications.notify([staff.email], "staffAdd", "Administrator");
    return { message: "Thêm nhân sự thành công", data: serializeStaff(staff) };
  }

  async list(query?: string, role?: string) {
    const users = await this.repository.list(query, role);
    return { users: users.map(serializeStaff), total: users.length };
  }

  async update(id: string, input: UpdateStaffDto, actorId: string) {
    const staff = await this.repository.findByIdWithPassword(id);
    if (!staff) throw new NotFoundException("Không tìm thấy người dùng");
    if (input.email && input.email !== staff.email.toLowerCase()) {
      const existing = await this.repository.findByEmail(input.email);
      if (existing && existing.id !== id) throw new ConflictException("Email đã được sử dụng");
    }
    const disablesAdmin = staff.role === "admin" && staff.active && (input.role && input.role !== "admin" || input.active === false);
    if (id === actorId && (input.role && input.role !== "admin" || input.active === false)) {
      throw new BadRequestException("Bạn không thể tự hạ quyền hoặc khóa tài khoản đang đăng nhập");
    }
    if (disablesAdmin && await this.repository.countActiveAdmins(id) === 0) {
      throw new BadRequestException("Hệ thống phải còn ít nhất một quản trị viên đang hoạt động");
    }
    await staff.update(input as any);
    return { message: "Cập nhật người dùng thành công", data: serializeStaff(staff) };
  }

  async resetPassword(id: string, password: string) {
    const staff = await this.repository.findByIdWithPassword(id);
    if (!staff) throw new NotFoundException("Không tìm thấy người dùng");
    await staff.update({ password: await bcrypt.hash(password, 12) });
    return { message: "Đặt lại mật khẩu thành công" };
  }

  async updatePassword(id: string, input: UpdatePasswordDto) {
    const staff = await this.repository.findByIdWithPassword(id);
    if (!staff || !staff.active) throw new NotFoundException("Không tìm thấy người dùng");
    if (staff.password && !(await bcrypt.compare(input.passwordCurrent, staff.password))) {
      throw new UnauthorizedException("Mật khẩu hiện tại không chính xác");
    }
    if (staff.password && await bcrypt.compare(input.password, staff.password)) {
      throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại");
    }
    await staff.update({ password: await bcrypt.hash(input.password, 12) });
    return { message: "Đổi mật khẩu thành công" };
  }

  async profile(id: string) {
    const staff = await this.repository.findByIdWithPassword(id);
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
    const existing = await this.repository.findByEmail(email);
    if (existing) {
      const updates: Record<string, unknown> = { role: "admin", name };
      // Seed chỉ tạo mật khẩu ban đầu; không ghi đè mật khẩu người dùng đã tự đổi.
      if (!existing.password) updates.password = await bcrypt.hash(password, 12);
      await existing.update(updates);
      return { action: "updated", email: existing.email };
    }
    const hashed = await bcrypt.hash(password, 12);
    const admin = await this.repository.create({ name, email: email.toLowerCase(), password: hashed, role: "admin" });
    return { action: "created", email: admin.email };
  }
}
