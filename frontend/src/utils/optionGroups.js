export const alphabeticalOptionGroups = (options) => {
  const groups = new Map();
  const other = [];
  [...options].sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "vi")).forEach((option) => {
    const label = String(option.label || "").trim();
    if (!option.value || !/^\p{L}/u.test(label)) { other.push(option); return; }
    const letter = label[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("vi");
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(option);
  });
  return [...groups].sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([label, items]) => ({ label, items }))
    .concat(other.length ? [{ label: "KHÁC", items: other }] : []);
};
