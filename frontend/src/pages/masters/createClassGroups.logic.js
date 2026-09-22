export const AUTO_ASSIGN_METHODS = {
  BALANCED: "balanced",
  FILL_FIRST: "fill_first",
  LOCATION: "location",
  CUSTOM: "custom",
};

const asCount = (value) => Math.max(0, Math.trunc(Number(value) || 0));

export const validateNameTemplate = (template) => {
  const normalized = String(template || "").trim();
  if (!normalized) return "Vui lòng nhập quy tắc tên nhóm.";
  if ((normalized.match(/\{n\}/g) || []).length !== 1) {
    return 'Quy tắc tên nhóm phải chứa đúng một ký hiệu "{n}".';
  }
  return "";
};

export const formatGroupName = (template, index) => (
  String(template || "").trim().replace("{n}", String(index).padStart(2, "0"))
);

export const getNextGroupIndex = (groups, template, codePrefix) => {
  const normalizedTemplate = String(template || "").trim();
  const escapedParts = normalizedTemplate.split("{n}").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const namePattern = escapedParts.length === 2 ? new RegExp(`^${escapedParts[0]}(\\d+)${escapedParts[1]}$`) : null;
  const codePattern = codePrefix ? new RegExp(`^${String(codePrefix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`) : null;
  const indexes = (groups || []).flatMap((group) => {
    const nameMatch = namePattern?.exec(String(group.name || ""));
    const codeMatch = codePattern?.exec(String(group.code || ""));
    return [nameMatch?.[1], codeMatch?.[1]].map(Number).filter(Number.isInteger);
  });
  return Math.max(0, ...indexes) + 1;
};

export const buildGroupNames = (template, startIndex, count) => (
  Array.from({ length: Math.min(10, asCount(count)) }, (_, offset) => formatGroupName(template, startIndex + offset))
);

export const calculateDistribution = ({ method, totalStudents, groupCount, maxStudents, customValues = [], groupNames = [] }) => {
  const total = asCount(totalStudents);
  const count = asCount(groupCount);
  const maximum = asCount(maxStudents);
  const emptyResult = { counts: [], error: "", remaining: total, complete: false, autoIndex: -1 };
  if (!count || !maximum) return emptyResult;
  if (total > count * maximum) {
    return {
      ...emptyResult,
      error: `Tổng sức chứa còn thiếu ${total - count * maximum} chỗ.`,
    };
  }

  if (method === AUTO_ASSIGN_METHODS.BALANCED) {
    const base = Math.floor(total / count);
    const remainder = total % count;
    return {
      counts: Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0)),
      error: "",
      remaining: 0,
      complete: true,
      autoIndex: -1,
    };
  }

  if (method === AUTO_ASSIGN_METHODS.FILL_FIRST) {
    let remaining = total;
    const counts = Array.from({ length: count }, () => {
      const value = Math.min(maximum, remaining);
      remaining -= value;
      return value;
    });
    return { counts, error: "", remaining, complete: remaining === 0, autoIndex: -1 };
  }

  if (method !== AUTO_ASSIGN_METHODS.CUSTOM) return emptyResult;

  const values = Array.from({ length: count }, (_, index) => {
    const raw = customValues[index];
    return raw === "" || raw === undefined || raw === null ? null : asCount(raw);
  });
  const blankIndexes = values.map((value, index) => (value === null ? index : -1)).filter((index) => index >= 0);
  const enteredTotal = values.reduce((sum, value) => sum + (value ?? 0), 0);
  if (enteredTotal > total) {
    return {
      counts: values,
      error: `Đã vượt quá ${enteredTotal - total} học viên.`,
      remaining: 0,
      complete: false,
      autoIndex: -1,
    };
  }

  let autoIndex = -1;
  if (blankIndexes.length === 1) {
    autoIndex = blankIndexes[0];
    values[autoIndex] = total - enteredTotal;
  }
  const overCapacityIndex = values.findIndex((value) => value !== null && value > maximum);
  if (overCapacityIndex >= 0) {
    return {
      counts: values,
      error: `${groupNames[overCapacityIndex] || `Nhóm ${overCapacityIndex + 1}`} vượt sĩ số tối đa ${maximum}.`,
      remaining: Math.max(0, total - enteredTotal),
      complete: false,
      autoIndex,
    };
  }
  const remaining = Math.max(0, total - values.reduce((sum, value) => sum + (value ?? 0), 0));
  return {
    counts: values,
    error: "",
    remaining,
    complete: blankIndexes.length === 1 || (blankIndexes.length === 0 && remaining === 0),
    autoIndex,
  };
};
