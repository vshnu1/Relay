export const date = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No data";
export const states = {
  context: "Context needed",
  review: "Ready for review",
  quiet: "No review trigger",
};
