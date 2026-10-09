export const shouldSuggestClosing = (offering) => {
  const credits = Number(offering?.subject?.credits);
  return offering?.status === "active" && [2, 3].includes(credits)
    && Number(offering?.sessionSummary?.heldCount || 0) >= credits * 2;
};
