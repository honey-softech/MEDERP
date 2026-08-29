import Link from "next/link";
import { compactButtonClass, compactFieldClass } from "@/components/auth-shell";
import { addCalendarDays, localDayKey, parseLocalDay } from "@/lib/front-desk";

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
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Link href={`${action}?date=${prev}`} className={compactButtonClass} title="Previous day">
        Prev
      </Link>
      <form className="flex min-w-0 items-center gap-1.5" action={action}>
        <input
          className={`${compactFieldClass} mt-0 w-auto`}
          type="date"
          name="date"
          defaultValue={dateValue}
          aria-label="Queue date"
        />
        <button className={compactButtonClass} type="submit">
          View
        </button>
      </form>
      <Link href={`${action}?date=${next}`} className={compactButtonClass} title="Next day">
        Next
      </Link>
      {!isToday ? (
        <Link href={action} className={compactButtonClass}>
          Today
        </Link>
      ) : null}
    </div>
  );
}
