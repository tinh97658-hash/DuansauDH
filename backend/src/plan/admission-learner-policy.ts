import { Op } from "sequelize";

export const admissionLearnerWhere = (activeOnly = false) => ({
  ...(activeOnly ? { studyStatus: { [Op.or]: [{ [Op.notIn]: ["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học", "Đã thôi học"] }, { [Op.is]: null }] } } : {}),
  [Op.or]: [
    { status: "approved" },
    { studyStatus: { [Op.in]: ["Đã trúng tuyển", "Đang học"] } },
  ],
});
