import { personLabel } from "@/lib/display";

export function boardAuthorName(author: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
  role: string;
  staffProfile?: { role?: string | null } | null;
}) {
  return personLabel({
    firstName: author.firstName,
    lastName: author.lastName,
    username: author.username,
    role: author.role,
    staffRole: author.staffProfile?.role,
  });
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
