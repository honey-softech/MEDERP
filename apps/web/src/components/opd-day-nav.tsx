import Link from "next/link";
import { addCalendarDays, localDayKey, parseLocalDay } from "@/lib/front-desk";
import { secondaryButtonClass } from "@/components/auth-shell";

export function OpdDayNav({
  dateValue,
  action,
}: {
  dateValue: string;
  action: string;
}) {
  const selected = parseLocalDay(dateValue);
  const prev = localDayKey(addCalendarDays(selected, -1));
  const next = localDayKey(addCalendarDays(selected, 1));
  const today = localDayKey(new Date());
  const isToday = dateValue === today;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Link href={`${action}?date=${prev}`} className={secondaryButtonClass}>
        Previous day
      </Link>
      <form className="flex items-end gap-2" action={action}>
        <label className="text-sm font-medium text-slate-700">
          Queue date
          <input
            className="mt-1 h-9 rounded-lg border border-slate-200 px-3 text-sm"
            type="date"
            name="date"
            defaultValue={dateValue}
          />
        </label>
        <button className={secondaryButtonClass} type="submit">
          View
        </button>
      </form>
      <Link href={`${action}?date=${next}`} className={secondaryButtonClass}>
        Next day
      </Link>
      {!isToday ? (
        <Link href={action} className="text-sm font-medium text-teal-700 hover:underline">
          Today
        </Link>
      ) : null}
    </div>
  );
}
