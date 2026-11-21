import Link from "next/link";
import { cookies, headers } from "next/headers";
import { requireRole, UUID } from "../../../../lib/guard";
import { changedDays, classById, classesBetween, type ClassRow } from "../../../../lib/dal/cifry";
import { digest } from "../../../../lib/dal/session";
import { classChange } from "../../../../lib/classes";
import { cycleWeek, dayNumber, dayStart, fmtLong, isDay, loc, monday, mskDay, mskTime, plural, shiftDay, SLOT_TIMES, today, WEEKDAYS } from "../../../../lib/time";
import { Page, Row, Tag, Empty } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { Sheet, SubmitButton } from "../../../../components/client";
import { subscribeCalendar } from "./actions";
import { TimetableViews, ViewOnly, ViewSwitch } from "../../../../components/timetable-views";
import { WeekGrid } from "../../../../components/week-grid";

export const metadata = { title: "Расписание" };

type SP = Promise<Record<string, string | string[] | undefined>>;

function endTag(c: ClassRow, going: boolean) {
  const ch = classChange(c);
  if (ch?.kind === "cancel") return <Tag k="bad">Отмена</Tag>;
  if (ch) return <Tag k="warn">{ch.tag}</Tag>;
  if (c.is_exam) return <Tag k="info">Экзамен</Tag>;
  if (going) return <Tag k="info">Идёт</Tag>;
  return undefined;
}

export default async function Timetable({ searchParams }: { searchParams: SP }) {
  const { token } = await requireRole("student");
  const sp = await searchParams;
  const now = today();
  const d = isDay(sp.d) ? sp.d : now;
  const c = typeof sp.c === "string" && UUID.test(sp.c) ? sp.c : null;
  const view = sp.view === "grid" || sp.view === "list" ? sp.view : null;
  const vq = view ? `&view=${view}` : "";
  const mon = monday(d);
  const [classes, week, marked, open] = await Promise.all([
    classesBetween(token, dayStart(d), dayStart(shiftDay(d, 1))),
    classesBetween(token, dayStart(mon), dayStart(shiftDay(mon, 6))),
    changedDays(token, dayStart(mon), dayStart(shiftDay(mon, 7))),
    c ? classById(token, c) : Promise.resolve(null),
  ]);
  const n = classes.filter((x) => x.status !== "cancelled").length;
  const t = Date.now();

  // the ICS link is shown once, right after it was created, and only to the same session
  let ics: string | null = null;
  if (sp.cal === "1") {
    const preview = (await cookies()).get("calendar_preview")?.value ?? "";
    const [owner, calToken] = preview.split(".");
    if (owner && calToken && owner === digest(token)) {
      const hd = await headers();
      const host = hd.get("x-forwarded-host") ?? hd.get("host") ?? "localhost";
      const proto = hd.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      ics = `${proto}://${host}/cal/${calToken}.ics`;
    }
  }

  return <TimetableViews initial={view} hrefs={{ list: `/timetable?d=${d}&view=list`, grid: `/timetable?d=${d}&view=grid` }}>
  <Page title="Расписание" head={<ViewSwitch />} fig={{ num: String(n), label: `${plural(n, "занятие", "занятия", "занятий")}, ${fmtLong(d)}` }}>
    <div className="wkrow">
      <Link href={`/timetable?d=${shiftDay(mon, -7)}${vq}`} aria-label="Предыдущая неделя"><Icon name="chevron-left" />неделя</Link>
      <span>Неделя {cycleWeek(d)} из 2</span>
      <Link href={`/timetable?d=${shiftDay(mon, 7)}${vq}`} aria-label="Следующая неделя">неделя<Icon name="chevron-right" /></Link>
    </div>
    <ViewOnly v="grid"><WeekGrid mon={mon} today={now} items={week.map((x) => ({ ...x, sub: x.teacher, href: `/timetable?d=${mskDay(x.starts_at)}&c=${x.id}${vq}` }))} /></ViewOnly>
    <ViewOnly v="list">
    <nav className="days" aria-label="Дни недели">{[0, 1, 2, 3, 4, 5].map((i) => {
      const dd = shiftDay(mon, i);
      return <Link key={dd} href={`/timetable?d=${dd}`} prefetch={true} className={"day" + (dd === d ? " on" : "")}
        aria-current={dd === d ? "date" : undefined} aria-label={fmtLong(dd) + (marked.has(dd) ? ", есть изменения" : "")}>
        <small>{WEEKDAYS[i]}</small><b>{dayNumber(dd)}</b>{marked.has(dd) && <i />}
      </Link>;
    })}</nav>
    {classes.length ? <div className="rows">{classes.map((x) => {
      const ch = classChange(x);
      const going = d === now && x.status !== "cancelled" && x.starts_at.getTime() <= t && x.ends_at.getTime() > t;
      const past = d === now && x.ends_at.getTime() <= t;
      return <Row key={x.id} href={`/timetable?d=${d}&c=${x.id}`} scroll={false} lead={mskTime(x.starts_at)} t={x.course}
        s={`${x.is_exam ? "Экзамен" : x.kind}, ${loc(x.room)}${ch?.was ? ", было " + ch.was : ""}`}
        cls={[ch?.kind === "cancel" ? "cancel" : "", going ? "now" : "", past ? "past" : ""].filter(Boolean).join(" ")}
        end={endTag(x, going)} />;
    })}</div> : <Empty icon="calendar-days" text="Занятий нет. Можно выбрать другой день или неделю." />}
    </ViewOnly>
    {ics ? <div className="box">
      <b>Календарь подключён</b>
      <span className="note">Откройте ссылку на телефоне: изменения расписания придут в календарь сами. Ссылка показывается один раз.</span>
      <a className="btn pri full" href={ics.replace(/^https?:/, "webcal:")}><Icon name="calendar-plus" />Добавить в календарь</a>
      <code style={{ fontSize: 12, overflowWrap: "anywhere" }}>{ics}</code>
    </div> : classes.length > 0 && <form action={subscribeCalendar}>
      <input type="hidden" name="d" value={d} />
      <SubmitButton className="btn sec full" pendingText="Создаём ссылку…"><Icon name="calendar-plus" />Подписать календарь телефона</SubmitButton>
    </form>}
    {open && <ClassSheet c={open} closeHref={`/timetable?d=${d}${vq}`} />}
  </Page>
  </TimetableViews>;
}

function ClassSheet({ c, closeHref }: { c: ClassRow; closeHref: string }) {
  const ch = classChange(c);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(c.starts_at);
  const slot = SLOT_TIMES.find((s) => s.startsWith(mskTime(c.starts_at)));
  return <Sheet title={c.course} closeHref={closeHref}>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {ch?.kind === "cancel" ? <Tag k="bad">Отмена</Tag> : ch?.kind === "moved-room" ? <Tag k="warn">Новая аудитория</Tag> : ch ? <Tag k="warn">Перенос</Tag> : null}
      <span style={{ fontSize: 13, opacity: .7 }}>{c.is_exam ? "Экзамен" : c.kind}</span>
    </div>
    {ch?.was && <dl className="ws"><dt>было</dt><dd className="was">{ch.was}</dd><dt>стало</dt><dd className="now">{ch.now}</dd></dl>}
    <ul className="facts">
      <li><Icon name="clock" /><span>{slot ?? `${mskTime(c.starts_at)}-${mskTime(c.ends_at)}`}, {fmtLong(day)}</span></li>
      {c.room && <li><Icon name="map-pin" /><span>{loc(c.room)}</span></li>}
      <li><Icon name="users" /><span>{c.group_name}</span></li>
      {c.teacher && <li><Icon name="user" /><span>{c.teacher}</span></li>}
    </ul>
    {c.reason && <p className="note"><b>Почему.</b> {c.reason}</p>}
    <Link className="btn sec full" href="/ask"><Icon name="message-circle" />Спросить деканат</Link>
  </Sheet>;
}
