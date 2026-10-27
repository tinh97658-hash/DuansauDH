import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Submission } from "../database/models/submission.model.js";
import { NotificationService } from "../notifications/notification.service.js";
import { serializeStudent } from "./student.serializer.js";
import { UpdatePasswordDto } from "./dto/password.dto.js";
import { StudentsRepository } from "./students.repository.js";
import { UploadStorageService } from "./upload-storage.service.js";

@Injectable()
export class StudentsService {
  constructor(
    private readonly students: StudentsRepository,
    private readonly notifications: NotificationService,
    @InjectModel(Submission) private readonly submissions: typeof Submission,
    private readonly storage: UploadStorageService,
  ) {}

  async profile(id: string) {
    const student = await this.students.findProfileById(id);
    if (!student) throw new NotFoundException("Không tìm thấy người dùng");
    return serializeStudent(student);
  }

  async forgotPassword(email: string, baseUrl: string) {
    const student = await this.students.findByEmail(email);
    if (!student) {
      return { status: "success", message: "Nếu email tồn tại trong hệ thống, mã đặt lại mật khẩu đã được gửi qua email" };
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    await student.update({
      passwordResetToken: crypto.createHash("sha256").update(resetToken).digest("hex"),
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
    });
    try {
      await this.notifications.send(student.email, "Mã đặt lại mật khẩu (có hiệu lực trong 10 phút)", `Đặt lại mật khẩu: ${baseUrl}/reset-password#${resetToken}`);
    } catch (error) {
      await student.update({ passwordResetToken: null, passwordResetExpires: null });
      throw error;
    }
    return { status: "success", message: "Nếu email tồn tại trong hệ thống, mã đặt lại mật khẩu đã được gửi qua email" };
  }

  async resetPassword(token: string, password: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const student = await this.students.findResetToken(hashedToken);
    if (!student) throw new BadRequestException("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    const changed = await this.students.replacePassword(student.id, student.password, await bcrypt.hash(password, 12), hashedToken);
    if (!changed) throw new BadRequestException("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    return { message: "Cập nhật mật khẩu thành công" };
  }

  async updatePassword(id: string, input: UpdatePasswordDto) {
    const student = await this.students.findByIdWithPassword(id);
    if (!student || !(await bcrypt.compare(input.passwordCurrent, student.password))) throw new UnauthorizedException("Mật khẩu hiện tại không chính xác");
    const changed = await this.students.replacePassword(student.id, student.password, await bcrypt.hash(input.password, 12));
    if (!changed) throw new UnauthorizedException("Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.");
    return { message: "Đổi mật khẩu thành công", sessionVersion: changed.sessionVersion };
  }

  async updatePhoto(id: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Vui lòng chọn ảnh đại diện");
    return this.storage.replace(id, "photo", file, async (transaction, filename) => {
      const student = await this.students.findById(id, { transaction });
      if (!student) throw new NotFoundException("Không thể cập nhật ảnh đại diện");
      const oldFile = student.photo;
      await student.update({ photo: filename }, { transaction });
      return { oldFile, value: { message: "Cập nhật người dùng thành công", user: serializeStudent(student) } };
    });
  }

  async submit(id: string, number: number, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Vui lòng chọn tệp cần nộp");
    await this.storage.replace(id, "submission", file, async (transaction, filename) => {
      const previous = await this.submissions.findOne({ where: { studentId: id, submissionNumber: number }, transaction });
      await this.submissions.upsert({ studentId: id, submissionNumber: number, fileName: filename }, { transaction });
      return { oldFile: previous?.fileName, value: undefined };
    });
    const student = await this.students.findProfileById(id);
    if (!student) throw new NotFoundException("Không tìm thấy người dùng");
    this.notifications.notify([student.email], "submission", "admin");
    return { message: "Nộp tệp thành công", user: serializeStudent(student) };
  }

  async registered() {
    return (await this.students.findRegistered()).map(serializeStudent);
  }
}
