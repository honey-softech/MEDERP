import type { WardCapacityRow } from "@/lib/wards";

export function WardCapacityCards({
  rows,
  title = "Room & bed availability",
}: {
  rows: WardCapacityRow[];
  title?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((row) => (
          <article
            key={row.code}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-800">{row.capacityLabel}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {row.available}
              <span className="text-base font-normal text-slate-400"> / {row.total}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {row.available} free · {row.occupied} occupied
              {row.housekeeping > 0 ? ` · ${row.housekeeping} cleaning` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
