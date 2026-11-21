import Link from "next/link";
import { requireRole } from "../../../../lib/guard";
import { attendance, exams, grades } from "../../../../lib/dal/cifry";
import { shortCourse } from "../../../../lib/home";
import { Empty, Page } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";

export const metadata = { title: "Успеваемость" };

export default async function Grades() {
  const { token } = await requireRole("student");
  const [rows, ex, att] = await Promise.all([grades(token), exams(token), attendance(token)]);
  const avg = rows.length ? Math.round(rows.reduce((s, g) => s + g.score, 0) / rows.length) : 0;
  const debts = rows.filter((g) => g.score < 50);
  const weakest = [...rows].sort((a, b) => a.score - b.score)[0];
  const session = ex[0] ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }).format(ex[0].starts_at) : null;
  return <Page title="Успеваемость" fig={{ num: String(avg), label: "средний балл из 100" }}>
    {rows.length ? <>
      <div className="box"><b>{debts.length ? `Долги: ${debts.map((d) => shortCourse(d.course)).join(", ")}.` : "Долгов нет."}</b>
        <span className="note">{weakest && `Слабее всего ${shortCourse(weakest.course)}: ${weakest.score}${weakest.note ? `, ${weakest.note}` : ""}.`}{session && ` Сессия с ${session}.`}</span></div>
      <div className="rows">{rows.map((g) => <div key={g.course_id} className="row plain">
        <span className="t">{g.course}</span><span className="end" style={{ fontWeight: 700 }}>{g.score}</span>
        <span className="s">{g.note ?? (g.assessment_kind === "exam" ? "экзамен" : "зачёт")}{g.attempts > 1 ? `, попытка ${g.attempts}` : ""}
          <span className="bar" style={{ ["--bar" as string]: g.score < 65 ? "#E0457B" : "#1F4FD8" }} role="img" aria-label={`${g.score} из 100`}><b style={{ width: `${g.score}%` }} /></span></span>
      </div>)}</div>
    </> : <Empty icon="trending-up" text="Оценок пока нет. Они появятся, когда преподаватель их выставит." />}
    {att.marked > 0 && <div className="box" id="attendance"><b>Посещаемость: {att.absent ? `${att.absent} ${att.absent === 1 ? "пропуск" : att.absent < 5 ? "пропуска" : "пропусков"}` : "без пропусков"}</b>
      <span className="note">Отмечено занятий: {att.marked}{att.excused ? `, уважительных пропусков: ${att.excused}` : ""}{att.late ? `, опозданий: ${att.late}` : ""}.
        {att.courses.length > 0 && ` Больше всего: ${att.courses.slice(0, 3).map((c) => `${shortCourse(c.course)} (${c.absent})`).join(", ")}.`}</span></div>}
    <Link className="btn sec full" href="/exams"><Icon name="calendar-check" />Расписание сессии</Link>
  </Page>;
}
