import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushNotificationsRead } from "@/lib/realtime";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const notifications = await prisma.staffNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const unreadCount = notifications.filter((row) => !row.isRead).length;

  return NextResponse.json({
    notifications: notifications.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      href: row.href,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
      appointmentId: row.appointmentId,
    })),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id)) : [];
  const markAll = Boolean(body?.all);

  await prisma.staffNotification.updateMany({
    where: {
      userId: user.id,
      isRead: false,
      ...(markAll ? {} : ids.length ? { id: { in: ids } } : { id: "__none__" }),
    },
    data: { isRead: true },
  });

  if (markAll || ids.length) {
    pushNotificationsRead(user.id, markAll ? { all: true } : { ids });
  }

  return NextResponse.json({ ok: true });
}
