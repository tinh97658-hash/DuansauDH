export const PROFILE_CATEGORIES = [
  "Bình thường",
  "Dự thính",
  "Sinh viên",
  "Cựu SV học trước",
  "Cựu SV Tiền thạc sỹ",
];

export const profileCategoryLabel = value => PROFILE_CATEGORIES.includes(value) ? value : PROFILE_CATEGORIES[0];
