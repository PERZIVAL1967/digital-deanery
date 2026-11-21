// The week grid (desktop, full screen): days Mon-Sat as columns, the six slots as rows. Shared by the student
// timetable, the dean's timetable and the teacher's «Мои занятия». Every lesson card fills its cell; rows have equal height.
import Link from "next/link";
import { classChange } from "../lib/classes";
import { dayNumber, fmtLong, loc, mskDay, mskTime, shiftDay, SLOT_TIMES, WEEKDAYS } from "../lib/time";

export type GridClass = {
  id: string; course: string; room: string; original_room: string | null; status: "scheduled" | "moved" | "cancelled";
  is_exam: boolean; starts_at: Date; ends_at: Date; original_start: Date | null; sub: string; href: string;
};

const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
/** a class belongs to the slot it starts in; exams at other times go to the slot that contains their start */
const slotOf = (d: Date) => {
  const start = minutes(mskTime(d));
  return Math.max(0, SLOT_TIMES.findIndex((s, k) => start >= minutes(s) && (k === SLOT_TIMES.length - 1 || start < minutes(SLOT_TIMES[k + 1]))));
};

export function WeekGrid({ mon, items, today, label }: { mon: string; items: GridClass[]; today: string; label?: string }) {
  const days = [0, 1, 2, 3, 4, 5].map((i) => shiftDay(mon, i));
  const now = Date.now();
  const cell = new Map<string, GridClass[]>();
  for (const x of items) {
    const key = `${mskDay(x.starts_at)}|${slotOf(x.starts_at)}`;
    cell.set(key, [...(cell.get(key) ?? []), x]);
  }
  return <div className="wgrid" role="table" aria-label={label ?? `Неделя с ${fmtLong(mon)}`}>
    <div className="wg-row wg-head" role="row"><span className="wg-t" role="columnheader" />
      {days.map((dd, i) => <span key={dd} role="columnheader" className={"wg-d" + (dd === today ? " today" : "")}>
        {WEEKDAYS[i]} <b>{dayNumber(dd)}</b>{dd === today && <small>сегодня</small>}</span>)}</div>
    {SLOT_TIMES.map((slot, si) => <div key={slot} className="wg-row wg-body" role="row">
      <span className="wg-t" role="rowheader">{slot.replace("-", "\n")}</span>
      {days.map((dd) => {
        const xs = cell.get(`${dd}|${si}`) ?? [];
        return <div key={dd} role="cell" className={"wg-c" + (dd === today ? " today" : "") + (xs.length ? "" : " empty") + (xs.length > 1 ? " multi" : "")}>
          {xs.map((x) => {
            const ch = classChange(x);
            const going = x.status !== "cancelled" && x.starts_at.getTime() <= now && x.ends_at.getTime() > now;
            const cls = "wg-x" + (ch?.kind === "cancel" ? " cancel" : ch ? " moved" : "") + (going ? " now" : "") + (x.is_exam ? " exam" : "");
            const roomMoved = x.original_room && x.original_room !== x.room;
            return <Link key={x.id} href={x.href} scroll={false} className={cls} title={`${x.course}, ${x.sub}`}
              aria-label={`${x.course}, ${mskTime(x.starts_at)}, ${loc(x.room)}${ch?.kind === "cancel" ? ", отмена" : ""}${going ? ", идёт сейчас" : ""}`}>
              <b>{x.course}</b>
              <span>{x.is_exam ? "Экзамен, " : ""}{ch?.kind === "cancel" ? <em>Отмена</em>
                : roomMoved ? <><s>{loc(x.original_room)}</s> {loc(x.room)}</> : loc(x.room)}
                {ch?.kind === "moved-time" && <em> перенос</em>}{going && <em> идёт</em>}</span>
              <small>{x.sub}</small>
            </Link>;
          })}
        </div>;
      })}
    </div>)}
  </div>;
}
