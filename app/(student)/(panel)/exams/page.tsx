import { requireRole } from "../../../../lib/guard";
import { exams } from "../../../../lib/dal/cifry";
import { daysBetween, fmtShort, loc, mskDay, mskTime, plural, today } from "../../../../lib/time";
import { Empty, Page, Row } from "../../../../components/ui";

export const metadata = { title: "Сессия" };

export default async function Exams() {
  const { token } = await requireRole("student");
  const rows = await exams(token);
  const first = rows[0];
  const days = first ? Math.max(0, daysBetween(today(), mskDay(first.starts_at))) : 0;
  return <Page title="Сессия" fig={first ? { num: String(days), unit: plural(days, "день", "дня", "дней"), label: "до первого экзамена", mid: true } : null}>
    {rows.length ? <>
      <div className="rows">{rows.map((e) => <Row key={e.id} lead={fmtShort(mskDay(e.starts_at))} t={e.course}
        s={`${e.assessment_kind === "exam" ? "экзамен" : "зачёт"}, ${mskTime(e.starts_at)}, ${loc(e.room)}${e.status === "cancelled" ? ", отменён" : ""}`} end=" " />)}</div>
      <p className="note">Допуск есть по всем предметам. Если что-то изменится, придёт уведомление.</p>
    </> : <Empty icon="calendar-check" text="Экзаменов впереди нет." />}
  </Page>;
}
