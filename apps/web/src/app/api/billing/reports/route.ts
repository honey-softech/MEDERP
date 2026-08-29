import { NextResponse } from "next/server";
import { BILLING_ROLES, forbidUnless, requireHospitalActor } from "@/lib/front-desk";
import { csvEscape, loadBillingReport, monthRange, parseYearMonth } from "@/lib/billing-reports";

export async function GET(request: Request) {
  const scoped = await requireHospitalActor();
  if (scoped.error) return scoped.error;
  const denied = forbidUnless(scoped.user.role, BILLING_ROLES);
  if (denied) return denied;

  const url = new URL(request.url);
  const range = monthRange(parseYearMonth(url.searchParams.get("month")));
  const report = await loadBillingReport(scoped.user.hospitalId, range.start, range.end);
  const kind = url.searchParams.get("kind") === "dues" ? "dues" : "collections";

  const lines =
    kind === "dues"
      ? [
          ["Invoice", "Patient", "Net total", "Paid", "Due", "Status", "Issued"].join(","),
          ...report.outstanding.map((row) =>
            [
              csvEscape(row.invoiceNo),
              csvEscape(row.patient),
              row.netTotal,
              row.paidAmount,
              row.due,
              csvEscape(row.status),
              csvEscape(row.issuedAt.toISOString()),
            ].join(","),
          ),
        ]
      : [
          ["Received at", "Patient", "Invoice", "Method", "Amount"].join(","),
          ...report.payments.map((row) =>
            [
              csvEscape(row.receivedAt.toISOString()),
              csvEscape(row.patient),
              csvEscape(row.invoice),
              csvEscape(row.method),
              row.amount,
            ].join(","),
          ),
        ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mederp-${kind}-${url.searchParams.get("month") ?? "month"}.csv"`,
    },
  });
}
