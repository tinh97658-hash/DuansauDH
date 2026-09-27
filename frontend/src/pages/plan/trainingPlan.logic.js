/** Tiện ích thuần cho trang Kế hoạch đào tạo (tab "Chương trình đào tạo theo khóa"). */

/** Rút gọn danh sách mã lớp để hiển thị gọn trong ô "Lớp áp dụng". */
export const compactClassCodes = (classes = [], max = 2) => {
  const codes = (classes || []).map((group) => group?.code).filter(Boolean);
  if (codes.length === 0) return "";
  if (codes.length <= max) return codes.join(", ");
  return `${codes.slice(0, max).join(", ")} +${codes.length - max}`;
};

/** Gợi ý mã CTĐT chưa trùng: một khóa có thể có nhiều CTĐT nên mã phải khác nhau. */
export const suggestCurriculumCode = (majorCode, year, existing = []) => {
  const base = `CT-${majorCode || "NGANH"}-${year}`;
  const taken = new Set((existing || []).map((item) => String(item?.code || "").toUpperCase()));
  if (!taken.has(base.toUpperCase())) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`.toUpperCase())) index += 1;
  return `${base}-${index}`;
};

/**
 * Nhóm CTĐT theo khóa áp dụng để phân biệt rõ chương trình của từng khóa.
 * Khóa mới nhất lên đầu; khóa chưa xác định ("—") xuống cuối.
 */
export const groupCurriculumsByYear = (curriculums = []) => {
  const byYear = new Map();
  for (const item of curriculums || []) {
    const key = String(item?.applicableFromYear ?? "").trim() || "—";
    if (!byYear.has(key)) byYear.set(key, []);
    byYear.get(key).push(item);
  }
  return [...byYear.entries()]
    .map(([year, items]) => ({
      year,
      items: [...items].sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "vi")),
    }))
    .sort((a, b) => {
      if (a.year === "—") return 1;
      if (b.year === "—") return -1;
      return String(b.year).localeCompare(String(a.year), "vi", { numeric: true });
    });
};

/** Tổng số lớp đang áp dụng trong một nhóm khóa. */
export const countGroupClasses = (items = []) => (items || [])
  .reduce((total, item) => total + (item?.classGroups || []).length, 0);
