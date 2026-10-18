export const DATE_PLACEHOLDER = "dd/mm/yy";
export const DATE_TIME_ZONE = "Asia/Ho_Chi_Minh";

const validKey = (year, month, day) => {
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${key}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : "";
};

// API/storage keep full ISO years. Two-digit input uses 1950–2049; when editing
// an existing record, retain its century if the two-digit year is unchanged.
export function parseDisplayDate(value, reference = "") {
  const text = String(value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
  if (iso) return validKey(iso[1], iso[2], iso[3]);
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
  if (!match) return "";
  let year = match[3];
  if (year.length === 2) {
    const referenceYear = /^(\d{4})-/.exec(String(reference))?.[1];
    year = referenceYear?.endsWith(year) ? referenceYear : `${Number(year) >= 50 ? "19" : "20"}${year}`;
  }
  return validKey(year, match[2], match[1]);
}

export function formatDate(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  const text = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : String(value);
  const key = parseDisplayDate(text);
  return key ? `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(2, 4)}` : text;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DATE_TIME_ZONE, day: "2-digit", month: "2-digit", year: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function formatDateTime(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
