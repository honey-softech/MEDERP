export type StaffNotice = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
  appointmentId?: string | null;
};

export const REALTIME_EVENTS = {
  notification: "notification",
  notificationsRead: "notifications:read",
  helpdeskTicket: "helpdesk:ticket",
} as const;

export type HelpdeskTicketUpdate = {
  ticketId: string;
  status: string;
  number: string;
};
