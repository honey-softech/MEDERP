import { doctorName, patientName } from "@/lib/front-desk";
import { prisma } from "@/lib/prisma";

export function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

export function parseYearMonth(value?: string | null) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

export function yearMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function loadBillingReport(hospitalId: string, start: Date, end: Date) {
  const [payments, refunds, dues] = await Promise.all([
    prisma.payment.findMany({
      where: { hospitalId, receivedAt: { gte: start, lt: end }, kind: { not: "REFUND" } },
      include: {
        patient: true,
        invoice: {
          include: {
            appointment: {
              include: { doctor: { include: { appUser: { select: { username: true } } } }, department: true },
            },
          },
        },
      },
      orderBy: { receivedAt: "asc" },
    }),
    prisma.payment.findMany({
      where: { hospitalId, receivedAt: { gte: start, lt: end }, kind: "REFUND" },
    }),
    prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      },
      include: { patient: true },
      orderBy: { issuedAt: "desc" },
      take: 200,
    }),
  ]);

  const collectedTotal = payments.reduce((sum, row) => sum + Number(row.amount), 0);
  const refundTotal = refunds.reduce((sum, row) => sum + Number(row.amount), 0);
  const byMethod = ["CASH", "CARD", "UPI", "INSURANCE", "ADVANCE"].map((method) => {
    const inAmount = payments.filter((row) => row.method === method).reduce((sum, row) => sum + Number(row.amount), 0);
    const outAmount = refunds.filter((row) => row.method === method).reduce((sum, row) => sum + Number(row.amount), 0);
    return { method, inAmount, outAmount, net: inAmount - outAmount };
  });

  const byDoctor = new Map<
    string,
    { name: string; department: string; cash: number; card: number; upi: number; other: number; total: number }
  >();
  for (const row of payments) {
    const doctor = row.invoice?.appointment?.doctor;
    const key = doctor?.id ?? "unassigned";
    const name = doctor ? doctorName(doctor) : "Unassigned / other bills";
    const department = row.invoice?.appointment?.department.name ?? "—";
    const current = byDoctor.get(key) ?? { name, department, cash: 0, card: 0, upi: 0, other: 0, total: 0 };
    const amount = Number(row.amount);
    if (row.method === "CASH") current.cash += amount;
    else if (row.method === "CARD") current.card += amount;
    else if (row.method === "UPI") current.upi += amount;
    else current.other += amount;
    current.total += amount;
    byDoctor.set(key, current);
  }

  const outstanding = dues
    .map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      patient: patientName(invoice.patient),
      netTotal: Number(invoice.netTotal),
      paidAmount: Number(invoice.paidAmount),
      due: Number(invoice.netTotal) - Number(invoice.paidAmount),
      status: invoice.status,
      issuedAt: invoice.issuedAt,
    }))
    .filter((row) => row.due > 0.009);

  return {
    collectedTotal,
    refundTotal,
    net: collectedTotal - refundTotal,
    paymentCount: payments.length,
    byMethod,
    doctorRows: [...byDoctor.values()].sort((a, b) => b.total - a.total),
    outstanding,
    payments: payments.map((row) => ({
      id: row.id,
      receivedAt: row.receivedAt,
      method: row.method,
      amount: Number(row.amount),
      patient: patientName(row.patient),
      invoice: row.invoice?.invoiceNo ?? "",
    })),
  };
}

export function csvEscape(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
