export const shouldSuggestClosing = (offering) => {
  return offering?.status === "active"
    && Number(offering?.sessionSummary?.heldCount || 0) >= 4;
};
