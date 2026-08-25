export const HELPDESK_CATEGORIES = [
  { value: "ACCESS", label: "Access / login" },
  { value: "TECHNICAL", label: "Technical issue" },
  { value: "BILLING", label: "Billing / subscription" },
  { value: "FEATURE", label: "Feature request" },
  { value: "ACCOUNT", label: "Hospital / user account" },
  { value: "OTHER", label: "Other" },
] as const;

export const HELPDESK_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
] as const;

export function prettyTicketStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export { ticketStatusClass as statusBadgeClass } from "@/lib/ui";
