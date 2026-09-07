export function invoiceStatusFromTotals(netTotal: number, paidAmount: number) {
  if (netTotal <= 0 || paidAmount + 0.001 >= netTotal) return "PAID" as const;
  if (paidAmount <= 0) return "ISSUED" as const;
  return "PARTIALLY_PAID" as const;
}

export const DEFAULT_OPD_FEE = 500;

export function consultationFeeForVisit(appointment: {
  visitType: string;
  doctor: { consultationFee?: { toString(): string } | number | null; followUpFee?: { toString(): string } | number | null };
  department?: { consultationFee?: { toString(): string } | number | null } | null;
  hospital?: { opdFee?: { toString(): string } | number | null } | null;
}) {
  const followUp = appointment.visitType === "FOLLOW_UP" ? Number(appointment.doctor.followUpFee ?? 0) : 0;
  if (appointment.visitType === "FOLLOW_UP" && followUp > 0) return followUp;
  const doctorFee = Number(appointment.doctor.consultationFee ?? 0);
  if (doctorFee > 0) return doctorFee;
  const hospitalFee = Number(appointment.hospital?.opdFee ?? 0);
  if (hospitalFee > 0) return hospitalFee;
  const departmentFee = Number(appointment.department?.consultationFee ?? 0);
  if (departmentFee > 0) return departmentFee;
  return DEFAULT_OPD_FEE;
}

export function amountsMatch(left: number, right: number) {
  return Math.abs(left - right) <= 0.01;
}

export function paymentNote(input: {
  method: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  referenceNo?: string | null;
  extra?: string | null;
}) {
  const parts: string[] = [];
  if (input.method === "CARD") {
    if (input.cardBrand) parts.push(input.cardBrand);
    if (input.cardLast4) parts.push(`ending ${input.cardLast4}`);
    if (input.referenceNo) parts.push(`Txn ${input.referenceNo}`);
  }
  if (input.extra) parts.push(input.extra);
  return parts.join(" · ") || null;
}
