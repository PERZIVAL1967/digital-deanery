import { requireRole, UUID } from "../../../../lib/guard";
import { facultyGroups, searchStudents } from "../../../../lib/dal/staff";
import { Empty, Page, Row, Tag } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";

export const metadata = { title: "Студенты" };

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; g?: string }> }) {
  const { token } = await requireRole("staff");
  const sp = await searchParams;
  const text = (sp.q ?? "").trim().slice(0, 60);
  const group = sp.g && UUID.test(sp.g) ? sp.g : null;
  const [rows, groups] = await Promise.all([searchStudents(token, text, group), facultyGroups(token)]);
  return <Page home="/staff" title="Студенты факультета" fig={{ num: String(rows.length), label: text || group ? "найдено" : "студентов" }}>
    <form method="get" action="/staff/students" className="box search" role="search">
      <div className="field"><label htmlFor="q">ФИО, логин или номер зачётной книжки</label>
        <input id="q" name="q" type="search" defaultValue={text} placeholder="Например: Миронова" /></div>
      <div className="field"><label htmlFor="g">Группа</label>
        <select id="g" name="g" defaultValue={group ?? ""}><option value="">Все группы</option>
          {groups.filter((g) => g.students > 0).map((g) => <option key={g.id} value={g.id}>{g.name}{g.stream ? `, поток ${g.stream}` : ""}</option>)}</select></div>
      <button type="submit" className="btn pri"><Icon name="search" />Найти</button>
    </form>
    {rows.length ? <div className="rows">{rows.map((s) => <Row key={s.id} href={`/staff/students/${s.id}`} lead={s.avg ?? "-"}
      t={s.name} s={`${s.group_name}${s.status && s.status !== "Обучается" ? `, ${s.status.toLowerCase()}` : ""}, пропусков ${s.absences}`}
      end={<>{s.debts > 0 && <Tag k="bad">Долги: {s.debts}</Tag>}{s.absences >= 6 && <Tag k="warn">Пропуски</Tag>}<Icon name="chevron-right" /></>} />)}</div>
      : <Empty icon="users" text="Никого не нашли. Проверьте написание." />}
    <p className="note dim">Слева средний балл.</p>
  </Page>;
}
