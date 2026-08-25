import type { Server } from "socket.io";
import { REALTIME_EVENTS, type HelpdeskTicketUpdate, type StaffNotice } from "./realtime-events";

const g = globalThis as typeof globalThis & { mederpIo?: Server };

export function setIO(io: Server) {
  g.mederpIo = io;
}

export function getIO() {
  return g.mederpIo;
}

export function pushNotificationToUser(userId: string, notice: StaffNotice) {
  getIO()?.to(`user:${userId}`).emit(REALTIME_EVENTS.notification, notice);
}

export function pushNotificationsRead(userId: string, payload: { ids?: string[]; all?: boolean }) {
  getIO()?.to(`user:${userId}`).emit(REALTIME_EVENTS.notificationsRead, payload);
}

export function pushHelpdeskTicketUpdate(userIds: string[], payload: HelpdeskTicketUpdate) {
  const io = getIO();
  if (!io) return;
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit(REALTIME_EVENTS.helpdeskTicket, payload);
  }
}
