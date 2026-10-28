import { Prisma } from "@prisma/client";
import { sundayApprovalWeek } from "@/lib/payroll";
import { notifyUser } from "@/lib/notifications";
import { sendFcmToUser } from "@/lib/push-fcm";
import { prisma } from "@/lib/prisma";
import { clinicTodayKey, dateKeyToUtc } from "@/lib/timesheet";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let started = false;

/** Once each Sunday in India, remind that hospital's admins to approve the week. */
export async function sendSundayTimesheetReminders(now = new Date()) {
  const today = clinicTodayKey(now);
  const weekStart = sundayApprovalWeek(today);
  if (!weekStart) return { hospitals: 0 };
  const weekDate = dateKeyToUtc(weekStart);
  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  let hospitalsNotified = 0;
  for (const hospital of hospitals) {
    try {
      await prisma.payrollSundayNotice.create({
        data: { hospitalId: hospital.id, weekStart: weekDate },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
    try {
      const waiting = await prisma.timesheetWeek.count({
        where: { hospitalId: hospital.id, weekStart: weekDate, status: "SUBMITTED" },
      });
      const admins = await prisma.appUser.findMany({
        where: { hospitalId: hospital.id, role: "SUPER_ADMIN", isActive: true },
        select: { id: true },
      });
      const body =
        waiting > 0
          ? `${waiting} timesheet${waiting === 1 ? "" : "s"} ${waiting === 1 ? "is" : "are"} waiting for approval.`
          : "Review this week's staff timesheets.";
      for (const admin of admins) {
        const row = await notifyUser({
          hospitalId: hospital.id,
          userId: admin.id,
          title: "Approve timesheets",
          body,
          href: "/hospital/timesheets",
        });
        await sendFcmToUser(admin.id, {
          id: row.id,
          title: row.title,
          body: row.body,
          href: row.href,
          isRead: false,
          createdAt: row.createdAt.toISOString(),
        });
      }
      hospitalsNotified += 1;
    } catch (error) {
      await prisma.payrollSundayNotice.deleteMany({ where: { hospitalId: hospital.id, weekStart: weekDate } });
      throw error;
    }
  }
  return { hospitals: hospitalsNotified };
}

export function startPayrollSundayWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    void sendSundayTimesheetReminders().catch((error) => {
      console.error("Timesheet Sunday reminder failed:", error);
    });
  };
  tick();
  setInterval(tick, SWEEP_INTERVAL_MS);
}
