const clean = (value) => String(value || "").trim().replace(/\s+/g, " ");

/**
 * Splits a Vietnamese display name into the two columns used by the system.
 * Prefer structured API fields and fall back to the last word of a legacy name.
 */
export const personNameParts = (personOrName) => {
  if (personOrName && typeof personOrName === "object") {
    const familyAndMiddle = clean(personOrName.lastName);
    const givenName = clean(personOrName.firstName);
    if (familyAndMiddle || givenName) return { familyAndMiddle, givenName };
    return personNameParts(personOrName.fullName ?? personOrName.name);
  }

  const words = clean(personOrName).split(" ").filter(Boolean);
  if (!words.length) return { familyAndMiddle: "—", givenName: "—" };
  return {
    familyAndMiddle: words.length > 1 ? words.slice(0, -1).join(" ") : "—",
    givenName: words.at(-1),
  };
};
