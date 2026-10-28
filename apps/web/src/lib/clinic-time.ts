/** Clinic wall clock. The production container runs in UTC, so patient-facing times must name this zone. */
export const CLINIC_TIME_ZONE = "Asia/Kolkata";

export function formatClinicDateTime(value: Date) {
  return value.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function formatClinicDate(value: Date) {
  return value.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: CLINIC_TIME_ZONE });
}

export function formatClinicTime(value: Date) {
  return value.toLocaleTimeString("en-IN", { timeStyle: "short", timeZone: CLINIC_TIME_ZONE });
}

/** HTML date inputs are stored as UTC midnight and have no clinic clock time. */
export function isUtcDateOnly(value: Date) {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

/** Date and time for an appointment WhatsApp. A date-only follow-up keeps the booked visit's clock. */
export function formatReminderClock(visitAt: Date, scheduledAt?: Date | null) {
  const clock = isUtcDateOnly(visitAt) && scheduledAt && !isUtcDateOnly(scheduledAt) ? scheduledAt : visitAt;
  const date = formatClinicDate(isUtcDateOnly(visitAt) ? visitAt : clock);
  const time = isUtcDateOnly(clock) ? "" : formatClinicTime(clock);
  return {
    date,
    time,
    when: time ? `${date}, ${time}` : date,
  };
}

export function formatClinicPrintStamp(value = new Date()) {
  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: CLINIC_TIME_ZONE,
  });
}

/** Time written into the visit-summary WhatsApp. Check-in is the visit clock. */
export function formatVisitSummaryWhen(appointment: {
  scheduledAt: Date;
  checkInAt?: Date | null;
  queueType?: string | null;
}) {
  return formatClinicDateTime(appointment.checkInAt ?? appointment.scheduledAt);
}
