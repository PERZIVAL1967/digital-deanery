import Link from "next/link";
import { requireRole, UUID } from "../../../../lib/guard";
import { staffClasses } from "../../../../lib/dal/cifry-staff";
import { classChange } from "../../../../lib/classes";
import { cycleWeek, dayStart, fmtLong, isDay, loc, monday, mskDay, mskTime, shiftDay, today } from "../../../../lib/time";
import { Alert, Empty, Page, Tag } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { SubmitButton } from "../../../../components/client";
import { editClass } from "../../actions";
import { TimetableViews, ViewOnly, ViewSwitch } from "../../../../components/timetable-views";
import { WeekGrid } from "../../../../components/week-grid";

export const metadata = { title: "Расписание" };
const RES: Record<string, [string, "ok" | "bad"]> = {
  ok: ["Готово. Студенты получили уведомление, расписание обновлено.", "ok"],
  stale: ["Занятие уже изменили или ничего не поменялось. Проверьте данные.", "bad"],
  overlap: ["В это время аудитория или преподаватель заняты. Выберите другое время или аудиторию.", "bad"],
};
const GROUPS = ["3МЭО-01", "3МЭО-02", "3МЭО-03"];

/** classes of a day; moving or cancelling notifies the students of the class (Codex's changeClass) */
export default async function StaffTimetable({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await requireRole("staff");
  const sp = await searchParams;
  const d = isDay(sp.d) ? sp.d : today();
  const g = GROUPS.includes(sp.g ?? "") ? sp.g! : null;
  const focus = sp.c && UUID.test(sp.c) ? sp.c : null;
  const view = sp.view === "grid" || sp.view === "list" ? sp.view : null;
  const mon = monday(d);
  const gg = g ?? GROUPS[0]; // the grid always shows one group
  const [all, week] = await Promise.all([staffClasses(token, dayStart(d), dayStart(shiftDay(d, 1))),
    staffClasses(token, dayStart(mon), dayStart(shiftDay(mon, 6)))]);
  const rows = g ? all.filter((r) => (r.groups ?? "").includes(g)) : all;
  const res = sp.res ? RES[sp.res] : null;
  const q = (over: Record<string, string | null>) => {
    const p = new URLSearchParams({ d, ...(g ? { g } : {}), ...(view ? { view } : {}) });
    for (const [k, v] of Object.entries(over)) if (v === null) p.delete(k); else p.set(k, v);
    return `/staff/timetable?${p}`;
  };
  return <TimetableViews initial={view} hrefs={{ list: q({ view: "list" }), grid: q({ view: "grid", g: gg }) }}>
  <Page home="/staff" title="Расписание факультета" head={<ViewSwitch />} fig={{ num: String(rows.filter((r) => r.status !== "cancelled").length), label: `занятий, ${fmtLong(d)}` }}>
    <ViewOnly v="grid">
      <div className="stack">
        <nav className="filters" aria-label="Группа для сетки">{GROUPS.map((x) => <Link key={x} href={q({ g: x })} aria-current={gg === x ? "true" : undefined} scroll={false}>{x}</Link>)}</nav>
        <div className="wkrow">
          <Link href={q({ d: shiftDay(mon, -7) })} scroll={false}><Icon name="chevron-left" />неделя</Link>
          <span>{gg}, неделя {cycleWeek(d)} из 2</span>
          <Link href={q({ d: shiftDay(mon, 7) })} scroll={false}>неделя<Icon name="chevron-right" /></Link>
        </div>
        <WeekGrid mon={mon} today={today()} label={`Расписание ${gg}`} items={week.filter((c) => (c.groups ?? "").includes(gg)).map((c) => ({ ...c,
          sub: /^Языковая группа/.test(c.kind) ? c.kind.replace(/^Языковая группа 3МЭО-/, "Англ. ") : `${c.kind}, ${c.teacher}`, href: `/staff/timetable?d=${mskDay(c.starts_at)}&g=${gg}&view=list&c=${c.id}#c-${c.id}` }))} />
      </div>
    </ViewOnly>
    <ViewOnly v="list">
    <div className="wkrow wrap">
      <Link href={q({ d: shiftDay(d, -1) })} scroll={false}><Icon name="chevron-left" />день</Link>
      <form method="get" action="/staff/timetable" className="field inl">
        <label htmlFor="day" className="sr">Дата</label>
        <input id="day" type="date" name="d" defaultValue={d} />
        {g && <input type="hidden" name="g" value={g} />}
        <button type="submit" className="btn sec sm">Показать</button>
      </form>
      <Link href={q({ d: shiftDay(d, 1) })} scroll={false}>день<Icon name="chevron-right" /></Link>
    </div>
    <nav className="filters" aria-label="Группа">
      <Link href={q({ g: null })} aria-current={!g ? "true" : undefined} scroll={false}>Все группы</Link>
      {GROUPS.map((x) => <Link key={x} href={q({ g: x })} aria-current={g === x ? "true" : undefined} scroll={false}>{x}</Link>)}
    </nav>
    {res && <Alert kind={res[1]}>{res[0]}</Alert>}
    {sp.err && <Alert>{sp.err === "reason" ? "Напишите причину: студенты увидят её в уведомлении." : "Проверьте дату, время (начало раньше конца) и аудиторию."}</Alert>}
    {rows.length ? <div className="stack">{rows.map((c) => {
      const ch = classChange(c);
      return <details key={c.id} className="box" open={focus === c.id} id={`c-${c.id}`}>
        <summary className="csum">
          <b className="tnum">{mskTime(c.starts_at)}</b>
          <span><b className={c.status === "cancelled" ? "strike" : undefined}>{c.course}</b>
            <span className="note dim block">{c.is_exam ? "Экзамен" : c.kind}, {loc(c.room)}, {c.teacher}, {c.students} студ.{c.groups ? ` (${c.groups})` : ""}{ch?.was ? `, было ${ch.was}` : ""}</span></span>
          <span>{ch?.kind === "cancel" ? <Tag k="bad">Отмена</Tag> : ch ? <Tag k="warn">{ch.tag}</Tag> : <Icon name="chevron-down" />}</span>
        </summary>
        {c.status === "cancelled" ? <p className="note">Занятие отменено. Изменить его нельзя.</p> : <div className="cforms mt">
          <form action={editClass} className="stack">
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="version" value={c.version} />
            <input type="hidden" name="mode" value="move" /><input type="hidden" name="back" value={d} />
            <b>Перенести или сменить аудиторию</b>
            <div className="field"><label htmlFor={`d-${c.id}`}>Дата</label><input id={`d-${c.id}`} type="date" name="day" required defaultValue={mskDay(c.starts_at)} /></div>
            <div className="two">
              <div className="field"><label htmlFor={`s-${c.id}`}>Начало</label><input id={`s-${c.id}`} type="time" name="start" required defaultValue={mskTime(c.starts_at)} /></div>
              <div className="field"><label htmlFor={`e-${c.id}`}>Конец</label><input id={`e-${c.id}`} type="time" name="end" required defaultValue={mskTime(c.ends_at)} /></div>
            </div>
            <div className="field"><label htmlFor={`r-${c.id}`}>Аудитория</label><input id={`r-${c.id}`} name="room" required maxLength={60} defaultValue={c.room} /></div>
            <div className="field"><label htmlFor={`w-${c.id}`}>Причина переноса</label><textarea id={`w-${c.id}`} name="reason" rows={3} required maxLength={1000} placeholder="Например: в аудитории сломан проектор. Студенты увидят причину в уведомлении." /></div>
            <SubmitButton className="btn pri" pendingText="Сохраняем…">Перенести и уведомить</SubmitButton>
          </form>
          <form action={editClass} className="stack cancelf">
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="version" value={c.version} />
            <input type="hidden" name="mode" value="cancel" /><input type="hidden" name="back" value={d} />
            <b>Отменить занятие</b>
            <div className="field"><label htmlFor={`cr-${c.id}`}>Причина отмены</label><textarea id={`cr-${c.id}`} name="reason" rows={3} required maxLength={1000} placeholder="Например: преподаватель в командировке. Студенты увидят причину в уведомлении." /></div>
            <SubmitButton className="btn danger" pendingText="Отменяем…">Отменить и уведомить</SubmitButton>
          </form>
        </div>}
      </details>;
    })}</div> : <Empty icon="calendar-days" text="В этот день занятий нет." />}
    </ViewOnly>
  </Page>
  </TimetableViews>;
}
