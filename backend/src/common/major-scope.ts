/**
 * Phạm vi danh mục chuyên ngành dùng chung cho toàn hệ thống.
 *
 * Chuyên ngành có `is_common = true` là bản ghi kỹ thuật chứa danh mục học phần kiến
 * thức chung cấp Viện. Đây không phải chuyên ngành để tuyển sinh, mở lớp hay gán hồ sơ.
 */
/** Điều kiện Sequelize loại chuyên ngành dùng chung khỏi danh sách lựa chọn. */
export const excludeCommonMajor = () => ({ isCommon: false });

/** Ngành kỹ thuật chứa chuyên ngành dùng chung — không dùng để tuyển sinh. */
export const COMMON_DISCIPLINE_CODE = "DUNG-CHUNG";
