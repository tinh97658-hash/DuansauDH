import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { col, fn, Op, where } from "sequelize";
import { Staff } from "../database/models/staff.model.js";
import { Student } from "../database/models/student.model.js";

@Injectable()
export class StaffRepository {
  constructor(@InjectModel(Staff) private readonly staff: typeof Staff) {}

  findByEmail(email: string, options: any = {}) {
    return this.staff.findOne({ ...options, where: where(fn("lower", col("email")), email.trim().toLowerCase()) });
  }

  findById(id: string, options: any = {}) {
    return this.staff.scope("withoutPassword").findByPk(id, options);
  }

  findAdmin() {
    return this.staff.scope("withoutPassword").findOne({ where: { role: "admin" }, order: [["createdAt", "ASC"]] });
  }

  findWithStudents(id: string) {
    return this.staff.scope("withoutPassword").findByPk(id, {
      include: [{ model: Student, as: "students", attributes: ["id", "fullName"], through: { attributes: [] } }],
    });
  }

  findSupervisors(identifiers: string[], options: any = {}) {
    const normalized = identifiers.map((value) => String(value).trim()).filter(Boolean);
    const ids = normalized.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
    const emails = normalized.filter((value) => value.includes("@")).map((value) => value.toLowerCase());
    if (!ids.length && !emails.length) return Promise.resolve([] as Staff[]);
    return this.staff.scope("withoutPassword").findAll({
      ...options,
      where: {
        role: { [Op.in]: ["supervisor", "admin"] },
        [Op.or]: [
          ...(ids.length ? [{ id: { [Op.in]: ids } }] : []),
          ...(emails.length ? [{ email: { [Op.in]: emails } }] : []),
        ],
      },
    });
  }

  create(values: any, options: any = {}): Promise<Staff> {
    return this.staff.create(values, options) as unknown as Promise<Staff>;
  }
}
