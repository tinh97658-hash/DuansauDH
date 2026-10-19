const displayText = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const normalizedName = (value) => displayText(value).normalize("NFC").toLocaleLowerCase("vi");

// Names determine ambiguity only. IDs remain the keys, including for same-name records.
// Pass the actual visible option set; do not introduce active/scope filtering here.
export const groupingMajorLabels = (majors) => {
  const counts = new Map();
  majors.forEach((major) => {
    const name = normalizedName(major.name);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const labels = new Map(majors.map((major) => {
    const name = displayText(major.name) || "Chuyên ngành chưa có tên";
    const code = displayText(major.code);
    return [major.id, counts.get(normalizedName(major.name)) > 1
      ? code ? `${code} — ${name}` : `${name} (chưa có mã chuyên ngành)`
      : name];
  }));
  // Invalid legacy catalogs may have neither distinct codes nor another staff-facing identifier.
  // Warn explicitly instead of inventing an ordinal or exposing a UUID.
  const seen = new Set();
  const unresolved = [...labels.values()].some((label) => {
    const key = normalizedName(label);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  return { labels, unresolved };
};
