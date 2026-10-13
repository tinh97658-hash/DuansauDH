import { offeringTitle } from "./shared";

const vietnameseNames = new Intl.Collator("vi", { usage: "sort", sensitivity: "base" });
const compareKey = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export function sortOfferingsByHeldSessions(offerings, direction = "default") {
  if (direction === "default") return offerings;
  const factor = direction === "asc" ? 1 : -1;
  return [...offerings].sort((left, right) =>
    factor * (Number(left.sessionSummary?.heldCount || 0) - Number(right.sessionSummary?.heldCount || 0))
    || vietnameseNames.compare(offeringTitle(left), offeringTitle(right))
    || compareKey(left.code || left.subject?.code || "", right.code || right.subject?.code || "")
    || compareKey(left.id || "", right.id || ""));
}
