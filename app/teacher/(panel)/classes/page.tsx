import Link from "next/link";
import { requireRole } from "../../../../lib/guard";
import { myClasses } from "../../../../lib/dal/teacher";
import { dayNumber, dayStart, fmtLong, isDay, loc, monday, mskDay, mskTime, plural, shiftDay, today, WEEKDAYS, cycleWeek } from "../../../../lib/time";
import { Empty, Page, Row, Tag } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { TimetableViews, ViewOnly, ViewSwitch } from "../../../../components/timetable-views";
import { WeekGrid } from "../../../../components/week-grid";

export const metadata = { title: "Мои занятия" };

export default async function Classes({ searchParams }: { searchParams: Promise<{ d?: string; view?: string }> }) {
  const { token } = await requireRole("teacher");
  const sp = await searchParams;
  const now = today();
  const d = isDay(sp.d) ? sp.d : now;
  const mon = monday(d);
  const week = await myClasses(token, dayStart(mon), dayStart(shiftDay(mon, 7)));
  const rows = week.filter((c) => mskDay(c.starts_at) === d);
  const t = Date.now();
  const n = rows.filter((c) => c.status !== "cancelled").length;
  const view = sp.view === "grid" || sp.view === "list" ? sp.view : null;
  const vq = view ? `&view=${view}` : "";
  return <TimetableViews initial={view} hrefs={{ list: `/teacher/classes?d=${d}&view=list`, grid: `/teacher/classes?d=${d}&view=grid` }}>
  <Page home="/teacher" title="Мои занятия" head={<ViewSwitch />} fig={{ num: String(n), label: `${plural(n, "пара", "пары", "пар")}, ${fmtLong(d)}` }}>
    <div className="wkrow">
      <Link href={`/teacher/classes?d=${shiftDay(mon, -7)}${vq}`} scroll={false}><Icon name="chevron-left" />неделя</Link>
      <span>Неделя {cycleWeek(d)} из 2</span>
      <Link href={`/teacher/classes?d=${shiftDay(mon, 7)}${vq}`} scroll={false}>неделя<Icon name="chevron-right" /></Link>
    </div>
    <ViewOnly v="grid"><WeekGrid mon={mon} today={now} label="Мои занятия за неделю"
      items={week.map((c) => ({ ...c, sub: c.is_exam ? "Экзамен" : c.section, href: `/teacher/classes/${c.id}` }))} /></ViewOnly>
    <ViewOnly v="list">
    <nav className="days" aria-label="Дни недели">{[0, 1, 2, 3, 4, 5].map((i) => {
      const dd = shiftDay(mon, i);
      const has = week.some((c) => mskDay(c.starts_at) === dd && c.status !== "cancelled");
      return <Link key={dd} href={`/teacher/classes?d=${dd}`} scroll={false} className={"day" + (dd === d ? " on" : "")} aria-current={dd === d ? "date" : undefined}
        aria-label={fmtLong(dd) + (has ? ", есть занятия" : "")}><small>{WEEKDAYS[i]}</small><b>{dayNumber(dd)}</b>{has && <i />}</Link>;
    })}</nav>
    {rows.length ? <div className="rows">{rows.map((c) => {
      const going = c.status !== "cancelled" && c.starts_at.getTime() <= t && c.ends_at.getTime() > t;
      const moved = c.original_room && c.original_room !== c.room;
      return <Row key={c.id} href={`/teacher/classes/${c.id}`} lead={mskTime(c.starts_at)} t={c.course}
        s={`${c.is_exam ? "Экзамен" : c.section}, ${loc(c.room)}${moved ? ` (было ${loc(c.original_room)})` : ""}, ${c.students} студ.`}
        cls={[c.status === "cancelled" ? "cancel" : "", going ? "now" : ""].filter(Boolean).join(" ")}
        end={c.status === "cancelled" ? <Tag k="bad">Отмена</Tag> : moved ? <Tag k="warn">Новая ауд.</Tag>
          : c.marked ? <Tag k={c.absent ? "warn" : "ok"}>{c.marked === c.students ? `${c.absent} н/б` : `${c.marked}/${c.students}`}</Tag> : going ? <Tag k="info">Идёт</Tag> : undefined} />;
    })}</div> : <Empty icon="calendar-days" text="В этот день у вас занятий нет." />}
    </ViewOnly>
  </Page>
  </TimetableViews>;
}
