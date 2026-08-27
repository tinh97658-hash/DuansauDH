import { Staff } from "../database/models/staff.model.js";

export const serializeStaff = (model: Staff) => {
  const value: any = model.get({ plain: true });
  const { id, password, students, ...rest } = value;
  return { _id: id, ...rest, students: students?.map((student: any) => student.id) || [] };
};
