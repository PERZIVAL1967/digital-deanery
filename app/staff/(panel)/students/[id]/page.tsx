import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../lib/guard";
import { studentCard } from "../../../../../lib/dal/staff";
import { requestName, STATUS_TAG } from "../../../../../lib/request-ui";
import type { Status } from "../../../../../lib/request-types";
import { fmtDayMonth, fmtWhen, mskTime } from "../../../../../lib/time";
import { Alert, Empty, FieldError, Page, Row, Tag } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";
import { SubmitButton } from "../../../../../components/client";
import { excuse, setGrade } from "../../../actions";

export const metadata = { title: "Карточка студента" };
const ERR: Record<string, string> = {
  reason: "Укажите причину: она попадёт в журнал изменений и в уведомление студенту.", invalid: "Проверьте значение.",
  name: "ФИО: два или три слова с заглавной буквы.", email: "Проверьте адрес почты.", phone: "Проверьте номер телефона.",
  score: "Балл от 0 до 100.", same: "Значение не изменилось.", stale: "Этот пропуск уже уважительный.",
  graded: "По курсу уже есть оценки: отчислить с курса по выбору нельзя.",
};

function Reason({ id, err }: { id: string; err?: boolean }) {
  return <div className="field"><label htmlFor={id}>Причина (обязательно)</label>
    <input id={id} name="reason" required maxLength={500} placeholder="Например: приказ № 12-с от 20.11" aria-invalid={err || undefined}
      aria-describedby={err ? `${id}-e` : undefined} />{err && <FieldError id={`${id}-e`}>{ERR.reason}</FieldError>}</div>;
}

export default async function StudentCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; f?: string }> }) {
  const { token } = await requireRole("staff");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await studentCard(token, id);
  if (!data) notFound();
  const sp = await searchParams;
  const { card: c, grades, absences, requests, log, sections } = data;
  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length) : 0;
  const debts = grades.filter((g) => g.score < 50);
  const unexcused = absences.filter((a) => a.status === "absent" && !a.excused);
  const myLang = sections.find((s) => s.kind === "language");
  return <Page home="/staff" title={c.name} back={{ href: "/staff/students", label: "Студенты" }} fig={{ num: String(avg), label: "средний балл из 100" }}>
    {sp.ok && <Alert kind="ok">Сохранено и записано в журнал изменений. Студент получил уведомление.</Alert>}
    {sp.error && sp.error !== "reason" && <Alert>{ERR[sp.error] ?? ERR.invalid}</Alert>}
    {sp.error === "reason" && <Alert>{ERR.reason}</Alert>}
    <div className="acts">
      <Tag k={c.study_status === "Обучается" || c.study_status === "Восстановлен" ? "ok" : "warn"}>{c.study_status ?? "статус не указан"}</Tag>
      <Tag k="info">{c.group_name}</Tag>{myLang && <Tag k="info">{myLang.title}</Tag>}
      {debts.length > 0 && <Tag k="bad">Долги: {debts.length}</Tag>}{unexcused.length > 0 && <Tag k="warn">Пропусков: {unexcused.length}</Tag>}
    </div>

    <section className="pfs" aria-labelledby="h-prof"><h3 id="h-prof">Профиль</h3>
      <dl>{([["Логин", c.login], ["Зачётная книжка", c.record_book], ["Группа", c.group_name], ["Поток", c.stream], ["Курс", c.course_year],
        ["Форма обучения", c.study_form], ["Дата рождения", c.birth_date], ["Email", c.email], ["Телефон", c.phone], ["Адрес", c.address]] as [string, string | number | null][])
        .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "-"}</dd></div>)}</dl>
    </section>

    <section className="pfs" aria-labelledby="h-groups"><h3 id="h-groups">Занятия студента ({sections.length})</h3>
      <ul className="facts">{sections.map((s) => <li key={s.section_id}><span className="note">{s.course}: {s.title}</span></li>)}</ul>
    </section>

    <section className="stack" id="grades" aria-labelledby="h-gr"><h3 id="h-gr" className="h3">Оценки</h3>
      {grades.length ? <div className="rows">{grades.map((g) => <div key={g.course_id} className="row plain">
        <span className="t">{g.course}</span><span className="end"><b className={g.score < 50 ? "bad-t" : undefined}>{g.score}</b></span>
        <span className="s">{g.note ?? (g.assessment_kind === "exam" ? "экзамен" : "зачёт")}, {fmtDayMonth(g.assessed_on)}{g.attempt_no > 1 ? `, попытка ${g.attempt_no}` : ""}{g.revision ? ", исправлена" : ""}
          <details className="more" open={sp.error === "reason" && sp.f === `grade-${g.course_id}`}><summary><Icon name="pen" />Исправить оценку</summary>
            <form action={setGrade} className="stack">
              <input type="hidden" name="student" value={c.id} /><input type="hidden" name="course" value={g.course_id} />
              <div className="field"><label htmlFor={`sc-${g.course_id}`}>Новый балл</label><input id={`sc-${g.course_id}`} name="score" type="number" min={0} max={100} required defaultValue={g.score} /></div>
              <Reason id={`gr-${g.course_id}`} err={sp.error === "reason" && sp.f === `grade-${g.course_id}`} />
              <p className="note dim">Студент и преподаватель получат уведомление; в журнале останется было, стало, кто и почему.</p>
              <SubmitButton className="btn pri" pendingText="Сохраняем…">Исправить</SubmitButton>
            </form></details></span>
      </div>)}</div> : <Empty icon="trending-up" text="Оценок пока нет." />}
    </section>

    <section className="stack" id="absences" aria-labelledby="h-ab"><h3 id="h-ab" className="h3">Пропуски и опоздания</h3>
      {absences.length ? <div className="rows">{absences.map((a) => <div key={a.occurrence_id} className="row plain">
        <span className="t">{a.course}</span>
        <span className="end">{a.status === "late" ? <Tag k="info">Опоздание</Tag> : a.excused ? <Tag k="ok">Уважительная</Tag> : <Tag k="bad">Пропуск</Tag>}</span>
        <span className="s">{fmtDayMonth(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(a.starts_at))}, {mskTime(a.starts_at)}{a.excuse_note ? `. ${a.excuse_note}` : ""}
          {a.status === "absent" && !a.excused && <form action={excuse} className="inl-form">
            <input type="hidden" name="student" value={c.id} /><input type="hidden" name="occurrence" value={a.occurrence_id} />
            <label className="sr" htmlFor={`ex-${a.occurrence_id}`}>Основание</label>
            <input id={`ex-${a.occurrence_id}`} name="reason" required maxLength={300} placeholder="Основание: справка, приказ" />
            <SubmitButton className="btn sec sm" pendingText="…">Уважительная</SubmitButton></form>}</span>
      </div>)}</div> : <Empty icon="user-check" text="Пропусков нет." />}
    </section>

    <section className="stack" aria-labelledby="h-rq"><h3 id="h-rq" className="h3">Заявки</h3>
      {requests.length ? <div className="rows">{requests.map((r) => <Row key={r.id} href={`/staff/requests/${r.id}`} t={requestName(r.kind)} s={fmtWhen(r.created_at)}
        end={<Tag k={STATUS_TAG[r.status as Status][0]}>{STATUS_TAG[r.status as Status][1]}</Tag>} />)}</div> : <Empty icon="clipboard" text="Заявок нет." />}
    </section>

    <section className="stack" aria-labelledby="h-log"><h3 id="h-log" className="h3"><Icon name="history" /> Журнал изменений</h3>
      {log.length ? <div className="rows">{log.map((l) => <div key={l.id} className="row plain">
        <span className="t">{l.field}</span><span className="end note">{fmtWhen(l.created_at)}</span>
        <span className="s"><s>{l.old_value ?? "-"}</s> {"->"} <b>{l.new_value ?? "-"}</b>. {l.actor}: {l.reason}</span>
      </div>)}</div> : <Empty icon="history" text="Изменений ещё не было." />}
    </section>
  </Page>;
}
