import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../lib/guard";
import { classRoster, myClass } from "../../../../../lib/dal/teacher";
import { fmtLong, loc, mskDay, mskTime, plural } from "../../../../../lib/time";
import { Alert, Page, Tag } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";
import { SubmitButton } from "../../../../../components/client";
import { mark, markRest } from "../../../actions";

export const metadata = { title: "Посещаемость" };
const BTN: [string, string][] = [["present", "Был"], ["late", "Опоздал"], ["absent", "Нет"]];

/** attendance of one class: one tap per student; the dean and the student see the totals */
export default async function Attendance({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string; m?: string }> }) {
  const { token } = await requireRole("teacher");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [c, roster] = await Promise.all([myClass(token, id), classRoster(token, id)]);
  if (!c) notFound();
  const sp = await searchParams;
  const absent = roster.filter((r) => r.status === "absent").length;
  const unmarked = roster.filter((r) => !r.status).length;
  const day = mskDay(c.starts_at);
  return <Page home="/teacher" title={`${c.course}, ${c.section}`} back={{ href: `/teacher/classes?d=${day}`, label: "Занятия" }}
    fig={{ num: String(absent), label: `${plural(absent, "отсутствует", "отсутствуют", "отсутствуют")} из ${roster.length}` }}>
    <div className="box">
      <span className="note">{fmtLong(day)}, {mskTime(c.starts_at)}-{mskTime(c.ends_at)}, {loc(c.room)}{c.original_room && c.original_room !== c.room ? ` (было ${loc(c.original_room)})` : ""}</span>
      {c.status === "cancelled" ? <Tag k="bad">Занятие отменено</Tag> : <span className="note dim">Отметка сохраняется сразу. Студент и деканат видят итог; уважительную причину ставит деканат.</span>}
    </div>
    {sp.all && <Alert kind="ok">Остальные отмечены как присутствующие.</Alert>}
    {c.status !== "cancelled" && <>
      {unmarked > 0 && <form action={markRest}><input type="hidden" name="occ" value={c.id} />
        <SubmitButton className="btn pri full" pendingText="Отмечаем…"><Icon name="user-check" />Остальные {unmarked} на месте</SubmitButton></form>}
      <ul className="att" aria-label="Студенты">{roster.map((r) => <li key={r.student_id} id={`s-${r.student_id}`} className={sp.m === r.student_id ? "hit" : undefined}>
        <span className="att-n"><b>{r.name}</b><small>{r.absences ? `пропусков по курсу: ${r.absences}` : "без пропусков"}{r.excused ? ", уважительная" : ""}</small></span>
        <form action={mark} className="att-b" aria-label={`Отметка: ${r.name}`}>
          <input type="hidden" name="occ" value={c.id} /><input type="hidden" name="student" value={r.student_id} />
          {BTN.map(([v, l]) => <button key={v} type="submit" name="status" value={v} className={"ab " + v} aria-pressed={r.status === v} aria-label={`${l}: ${r.name}`}>
            <span aria-hidden="true">{l}</span></button>)}
        </form>
      </li>)}</ul>
    </>}
  </Page>;
}
