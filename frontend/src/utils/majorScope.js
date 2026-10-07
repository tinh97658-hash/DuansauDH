/**
 * Phạm vi danh mục chuyên ngành dùng chung ở frontend — phải khớp
 * `backend/src/common/major-scope.ts`.
 */
/** Chuyên ngành kỹ thuật chứa học phần chung cấp Viện, không phải chuyên ngành để chọn. */
export const isCommonMajor = (major) => Boolean(major) && major.isCommon === true;

/** Nhãn hiển thị chuyên ngành kèm ngành để phân biệt khi nhiều ngành có tên chuyên ngành giống nhau. */
export const majorLabel = (major) => {
  if (!major) return "";
  const name = major.name || "";
  const discipline = major.discipline?.name;
  return discipline ? `${name} · ${discipline}` : name;
};
