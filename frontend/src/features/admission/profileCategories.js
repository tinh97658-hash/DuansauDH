export const DEFAULT_PROFILE_CATEGORIES = [
  "Bình thường",
  "Dự thính",
  "Sinh viên",
  "Cựu SV học trước",
  "Cựu SV Tiền thạc sỹ",
];

export const PROFILE_CATEGORIES = DEFAULT_PROFILE_CATEGORIES;

const PROFILE_CATEGORY_ALIASES = {
  "hồ sơ bình thường": "Bình thường",
  "học trước": "Cựu SV học trước",
  "đã học tiền thạc sĩ": "Cựu SV Tiền thạc sỹ",
  "cựu sv tiền thạc sĩ": "Cựu SV Tiền thạc sỹ",
};

export const profileCategoryOptions = (types = [], currentValue = "") => {
  const names = Array.isArray(types) && types.length
    ? types.map((t) => (typeof t === "string" ? t : t?.name || "").trim()).filter(Boolean)
    : DEFAULT_PROFILE_CATEGORIES;
  const list = [...new Set(names)];
  const current = String(currentValue || "").trim();
  const normalized = PROFILE_CATEGORY_ALIASES[current.toLowerCase()] || current;
  if (normalized && !list.includes(normalized)) list.push(normalized);
  return list.length ? list : DEFAULT_PROFILE_CATEGORIES;
};

export const profileCategoryLabel = (value, types = []) => {
  const text = String(value || "").trim();
  if (!text) return DEFAULT_PROFILE_CATEGORIES[0];
  const mapped = PROFILE_CATEGORY_ALIASES[text.toLowerCase()] || text;
  const names = Array.isArray(types) && types.length
    ? types.map((t) => (typeof t === "string" ? t : t?.name || "").trim()).filter(Boolean)
    : [];
  const exactConfigured = names.find((item) => item.toLowerCase() === mapped.toLowerCase());
  if (exactConfigured) return exactConfigured;
  if (DEFAULT_PROFILE_CATEGORIES.includes(mapped)) return mapped;
  return text;
};
