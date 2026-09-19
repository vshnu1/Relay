const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
export const numberWord = (n, capital = false) => {
  const word = WORDS[n] ?? String(n);
  return capital ? word[0].toUpperCase() + word.slice(1) : word;
};
export const sentence = (text, stop = true) =>
  text[0].toUpperCase() + text.slice(1) + (stop ? "." : "");
export const list = (items) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export function ago(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
export function clock(t, now = Date.now()) {
  const time = new Date(t)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  const days = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) /
      86400000,
  );
  return `${days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`} at ${time}`;
}
export const dateLong = (t) =>
  new Date(t).toLocaleDateString([], { month: "long", day: "numeric" });
