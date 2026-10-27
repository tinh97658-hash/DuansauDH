import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { col, fn, literal, Op, where } from "sequelize";
import { Student } from "../database/models/student.model.js";
import { Submission } from "../database/models/submission.model.js";

@Injectable()
export class StudentsRepository {
  constructor(@InjectModel(Student) private readonly students: typeof Student) {}

  findByEmail(email: string, options: any = {}) {
    return this.students.findOne({ ...options, where: where(fn("lower", col("email")), email.trim().toLowerCase()) });
  }

  findById(id: string, options: any = {}) {
    return this.students.findByPk(id, {
      attributes: { exclude: ["password", "passwordResetToken", "passwordResetExpires"] },
      ...options,
    });
  }

  findByIdWithPassword(id: string) {
    return this.students.findByPk(id);
  }

  findProfileById(id: string) {
    return this.students.findByPk(id, {
      attributes: { exclude: ["password", "passwordResetToken", "passwordResetExpires"] },
      include: [{ model: Submission, as: "submissions" }],
    });
  }

  findRegistered() {
    return this.students.findAll({
      where: { accountType: "registered" },
      attributes: { exclude: ["password", "passwordResetToken", "passwordResetExpires"] },
      order: [["fullName", "ASC"]],
    });
  }

  findResetToken(token: string) {
    return this.students.findOne({ where: { passwordResetToken: token, passwordResetExpires: { [Op.gt]: new Date() } } });
  }

  async replacePassword(id: string, previousPassword: string, password: string, resetToken?: string) {
    const [count, rows] = await this.students.update({ password, sessionVersion: literal('"session_version" + 1'),
      passwordResetToken: null, passwordResetExpires: null }, {
      where: { id, password: previousPassword, ...(resetToken ? {
        passwordResetToken: resetToken, passwordResetExpires: { [Op.gt]: new Date() },
      } : {}) }, returning: true,
    });
    return count === 1 ? rows[0] : null;
  }

}
