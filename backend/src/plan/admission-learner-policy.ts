import { Op } from "sequelize";

export const admissionLearnerWhere = () => ({
  [Op.or]: [
    { status: "approved" },
    { studyStatus: { [Op.in]: ["Đã trúng tuyển", "Đang học"] } },
  ],
});
