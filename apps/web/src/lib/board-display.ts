export function boardAuthorName(author: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
  role: string;
}) {
  const full = [author.firstName, author.lastName].filter(Boolean).join(" ").trim();
  const base = full || author.username.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (author.role === "DOCTOR" && !/^dr\b/i.test(base)) return `Dr. ${base}`;
  return base;
}

export function prettyRole(role: string) {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatBoardTime(value: string | Date) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
