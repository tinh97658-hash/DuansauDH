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

export const normalizeSubjectName = (value = "") => String(value)
  .trim()
  .toLocaleLowerCase("vi")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const editDistance = (left, right) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};

const subjectNameMatchRank = (name, query) => {
  const normalizedName = normalizeSubjectName(name);
  const normalizedQuery = normalizeSubjectName(query);
  if (normalizedQuery.length < 2 || !normalizedName) return null;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;

  const nameTokens = normalizedName.split(" ");
  const queryTokens = normalizedQuery.split(" ");
  const tokensMatch = queryTokens.every((queryToken) => nameTokens.some((nameToken) => (
    nameToken.startsWith(queryToken)
    || (queryToken.length >= 3 && editDistance(queryToken, nameToken) <= 1)
  )));
  if (tokensMatch) return 3;

  const tolerance = Math.max(1, Math.floor(Math.max(normalizedName.length, normalizedQuery.length) * 0.2));
  return editDistance(normalizedName, normalizedQuery) <= tolerance ? 4 : null;
};

/** Gợi ý tên học phần theo chuỗi con, không dấu và lỗi gõ nhẹ. */
export const findSimilarSubjects = (subjects = [], query = "", { excludeId = null, limit = 8 } = {}) => (
  (subjects || [])
    .filter((subject) => subject?.id !== excludeId)
    .map((subject) => ({ subject, rank: subjectNameMatchRank(subject?.name, query) }))
    .filter((item) => item.rank !== null)
    .sort((left, right) => left.rank - right.rank
      || String(left.subject.name || "").localeCompare(String(right.subject.name || ""), "vi"))
    .slice(0, limit)
    .map((item) => item.subject)
);
