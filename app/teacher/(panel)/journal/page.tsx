import { requireRole } from "../../../../lib/guard";
import { mySections } from "../../../../lib/dal/teacher";
import { Empty, Page, Row, Tag } from "../../../../components/ui";

export const metadata = { title: "Журнал" };
const KIND: Record<string, string> = { lecture: "Лекция", seminar: "Семинар", language: "Языковая группа", elective: "По выбору" };

export default async function Journals() {
  const { token } = await requireRole("teacher");
  const rows = await mySections(token);
  return <Page home="/teacher" title="Журнал" fig={{ num: String(rows.length), label: "групп, где вы ведёте занятия" }}>
    {rows.length ? <div className="rows">{rows.map((s) => <Row key={s.id} href={`/teacher/journal/${s.id}`} t={s.course} s={`${s.title}, ${s.students} студ.`}
      end={<><Tag k={s.kind === "language" ? "ok" : s.kind === "lecture" ? "info" : "warn"}>{KIND[s.kind] ?? s.kind}</Tag></>} />)}</div>
      : <Empty icon="users" text="У вас пока нет групп с занятиями." />}
  </Page>;
}
