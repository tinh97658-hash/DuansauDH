/**
 * Phạm vi danh mục chuyên ngành dùng chung cho toàn hệ thống.
 *
 * `CHUYEN-NGANH-CHUNG` là chuyên ngành kỹ thuật chứa danh mục học phần kiến thức chung
 * cấp Viện (triết học, ngoại ngữ, phương pháp nghiên cứu…). Đây **không** phải chuyên
 * ngành để tuyển sinh, mở lớp hay gán hồ sơ học viên, nên phải bị loại khỏi mọi danh
 * sách lựa chọn chuyên ngành.
 */
export const COMMON_MAJOR_CODE = "CHUYEN-NGANH-CHUNG";

/** Điều kiện Sequelize loại chuyên ngành dùng chung khỏi danh sách lựa chọn. */
export const excludeCommonMajor = () => ({ code: { ne: COMMON_MAJOR_CODE } });

/** Ngành kỹ thuật chứa chuyên ngành dùng chung — không dùng để tuyển sinh. */
export const COMMON_DISCIPLINE_CODE = "DUNG-CHUNG";
