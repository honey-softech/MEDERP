export type StaffNotice = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
  appointmentId?: string | null;
};

/** Chat alerts are push-only. They are not kept on the notification bell. */
export const HOSPITAL_CHAT_NOTICE_TITLES = ["New hospital message", "Reply on hospital chat"] as const;

export function isHospitalChatNotice(title: string) {
  return (HOSPITAL_CHAT_NOTICE_TITLES as readonly string[]).includes(title);
}

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
