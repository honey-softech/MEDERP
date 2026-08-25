import Link from "next/link";
import { secondaryButtonClass } from "@/components/auth-shell";
import { VitalsPanel } from "@/components/vitals-panel";
import { doctorName, prettyEnum, tokenLabel } from "@/lib/front-desk";
import { toVitalsValues } from "@/lib/vitals";

type VisitRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  visitType: string;
  tokenNumber: number | null;
  department: { name: string };
  doctor: { firstName: string; lastName: string; appUser?: { username: string } | null };
  vitals: {
    heightCm: { toString(): string };
    weightKg: { toString(): string };
    bmi: { toString(): string };
    temperatureC: { toString(): string };
    hasFever: boolean;
    spo2Percent: number | null;
    pulseBpm: number | null;
    respiratoryRate: number | null;
    bpSystolic: number | null;
    bpDiastolic: number | null;
    bloodSugarMgDl: { toString(): string } | number | null;
    notes: string | null;
    recordedByUsername: string;
    recordedAt: Date;
  } | null;
  assessment: { status: string; diagnosis: string | null; approvedAt: Date | null } | null;
  labOrders?: Array<{
    id: string;
    status: string;
    reportFileName?: string | null;
    items: Array<{ id: string; nameSnapshot: string }>;
  }>;
};

export function PatientVisitHistory({
  visits,
  canPrintSummary,
  canViewLabReports = false,
}: {
  visits: VisitRow[];
  canPrintSummary: boolean;
  canViewLabReports?: boolean;
}) {
  const last = visits[0];

  return (
    <section className="mt-8 max-w-5xl space-y-6">
      {last ? (
        <article className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Last visit</p>
              <h3 className="mt-1 font-semibold text-slate-900">
                {last.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {doctorName(last.doctor)} · {last.department.name} · {prettyEnum(last.visitType)} · {tokenLabel(last.tokenNumber)}
              </p>
            </div>
            <Link href={`/appointments/${last.id}`} className={secondaryButtonClass}>
              Open visit
            </Link>
          </div>
          {last.vitals ? (
            <div className="mt-4">
              <VitalsPanel vitals={toVitalsValues(last.vitals)} />
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No vitals were recorded for this visit.
            </p>
          )}
          {last.assessment ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium text-slate-900">
                Visit summary · {last.assessment.status === "APPROVED" ? "Approved" : "Draft"}
              </p>
              {last.assessment.diagnosis ? (
                <p className="mt-1 text-slate-600">Diagnosis: {last.assessment.diagnosis}</p>
              ) : null}
              {last.assessment.status === "APPROVED" && canPrintSummary ? (
                <Link href={`/appointments/${last.id}/summary`} className="mt-2 inline-block text-teal-700 hover:underline">
                  View / print summary
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No doctor assessment recorded for this visit.</p>
          )}
          {last.labOrders && last.labOrders.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium text-slate-900">Lab</p>
              <ul className="mt-2 space-y-2">
                {last.labOrders.flatMap((order) =>
                  order.items.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.nameSnapshot}</span>
                    </li>
                  )),
                )}
              </ul>
              {canViewLabReports
                ? last.labOrders
                    .filter((order) => order.status === "RESULTED" && order.reportFileName)
                    .map((order) => (
                      <a
                        key={order.id}
                        className="mt-2 block font-medium text-teal-700 hover:underline"
                        href={`/api/lab/orders/${order.id}/report`}
                      >
                        Open lab report · {order.reportFileName}
                      </a>
                    ))
                : null}
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="font-semibold">Visit history</h3>
        <p className="mt-1 text-sm text-slate-500">Each visit keeps its own vitals and summary record.</p>
        <ul className="mt-4 space-y-3">
          {visits.length === 0 ? (
            <li className="text-sm text-slate-500">No visits yet.</li>
          ) : (
            visits.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link className="font-medium text-teal-700 hover:underline" href={`/appointments/${row.id}`}>
                      {row.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </Link>
                    <p className="mt-0.5 text-slate-600">
                      {doctorName(row.doctor)} · {row.department.name} · {prettyEnum(row.status)} · {tokenLabel(row.tokenNumber)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 ${row.vitals ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>
                      {row.vitals ? "Vitals recorded" : "No vitals"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 ${
                        row.assessment?.status === "APPROVED"
                          ? "bg-teal-50 text-teal-800"
                          : row.assessment
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {row.assessment?.status === "APPROVED"
                        ? "Summary approved"
                        : row.assessment
                          ? "Summary draft"
                          : "No summary"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 ${
                        row.labOrders?.some((order) => order.status === "RESULTED")
                          ? "bg-teal-50 text-teal-800"
                          : row.labOrders && row.labOrders.length > 0
                            ? "bg-sky-50 text-sky-800"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.labOrders?.some((order) => order.status === "RESULTED")
                        ? "Lab results"
                        : row.labOrders && row.labOrders.length > 0
                          ? "Lab ordered"
                          : "No lab"}
                    </span>
                  </div>
                </div>
                {row.assessment?.status === "APPROVED" && canPrintSummary ? (
                  <Link href={`/appointments/${row.id}/summary`} className="mt-2 inline-block text-teal-700 hover:underline">
                    Print visit summary
                  </Link>
                ) : null}
                {canViewLabReports
                  ? row.labOrders
                      ?.filter((order) => order.status === "RESULTED" && order.reportFileName)
                      .map((order) => (
                        <a
                          key={order.id}
                          className="mt-2 block text-xs font-medium text-teal-700 hover:underline"
                          href={`/api/lab/orders/${order.id}/report`}
                        >
                          Open lab report · {order.reportFileName}
                        </a>
                      ))
                  : null}
              </li>
            ))
          )}
        </ul>
      </article>
    </section>
  );
}
