import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../lib/guard";
import { journal } from "../../../../../lib/dal/teacher";
import { fmtShort, today } from "../../../../../lib/time";
import { Alert, Page } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";
import { SubmitButton } from "../../../../../components/client";
import { CellInput } from "../../../../../components/journal-cell";
import { addColumn, cell, importExcel } from "../../../actions";

export const metadata = { title: "Журнал группы" };
const IMPORT: Record<string, [string, "ok" | "bad"]> = {
  ok: ["Оценки из Excel загружены. Студенты получили уведомления.", "ok"], duplicate: ["Эти оценки уже загружены для этой группы.", "bad"],
  roster: ["В файле есть студент не из этой группы. Ничего не загружено.", "bad"], scope: ["Выберите свою группу.", "bad"],
  invalid: ["Проверьте файл XLSX: столбцы login и score, баллы от 0 до 100, без повторов.", "bad"],
};
const OK: Record<string, string> = { mark: "Оценка опубликована, студент её уже видит.", column: "Столбец добавлен.",
  proposed: "Исправление отправлено в деканат. Пока его не примут, студент видит прежнюю оценку." };
const ERR: Record<string, string> = { score: "Балл от 0 до 100.", pending: "Исправление этой оценки уже ждёт решения деканата.", same: "Оценка не изменилась.", column: "Нужны название до 80 знаков и дата." };

/** students x assessments. Typing into an empty cell publishes the mark; changing a published one asks for a reason and goes to the dean */
export default async function JournalGrid({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await requireRole("teacher");
  const { section } = await params;
  if (!UUID.test(section)) notFound();
  const j = await journal(token, section);
  if (!j) notFound();
  const sp = await searchParams;
  const all = Object.values(j.marks);
  const avg = all.length ? Math.round(all.reduce((s, x) => s + x, 0) / all.length) : 0;
  const [fixA, fixS] = (sp.fix ?? "").split(".");
  const fixStudent = j.students.find((s) => s.id === fixS), fixCol = j.assessments.find((a) => a.id === fixA);
  const imp = sp.import ? IMPORT[sp.import] : null;
  return <Page home="/teacher" title={`${j.section.course}, ${j.section.title}`} back={{ href: "/teacher/journal", label: "Журнал" }}
    fig={{ num: String(avg), label: "средний балл в журнале" }}>
    {sp.ok && OK[sp.ok] && <Alert kind="ok">{OK[sp.ok]}</Alert>}
    {sp.error && ERR[sp.error] && <Alert>{ERR[sp.error]}</Alert>}
    {imp && <Alert kind={imp[1]}>{imp[0]}</Alert>}
    {fixStudent && fixCol && /^\d{1,3}$/.test(sp.v ?? "") && <form action={cell} className="box warnbox">
      <b>Исправление опубликованной оценки</b>
      <span className="note">{fixStudent.name}, {fixCol.title}: {j.marks[`${fixA}|${fixS}`]} {"->"} {sp.v}. Исправление уходит в деканат и вступит в силу после подтверждения.</span>
      <input type="hidden" name="section" value={section} /><input type="hidden" name="a" value={fixA} /><input type="hidden" name="s" value={fixS} />
      <input type="hidden" name="score" value={sp.v} />
      <div className="field"><label htmlFor="why">Причина</label><input id="why" name="reason" required maxLength={500} placeholder="Например: пересчитала баллы за задачу 3" autoFocus /></div>
      <SubmitButton pendingText="Отправляем…">Отправить в деканат</SubmitButton>
    </form>}
    <div className="jgrid-wrap" role="region" aria-label="Журнал" tabIndex={0}>
      <table className="jgrid">
        <thead><tr><th scope="col">Студент</th>{j.assessments.map((a) => <th key={a.id} scope="col"><span>{a.title}</span><small>{fmtShort(a.held_on)}{a.assignment ? ", задание" : ""}</small></th>)}
          <th scope="col" title="Пропуски без уважительной причины">Н/б</th></tr></thead>
        <tbody>{j.students.map((s) => <tr key={s.id}><th scope="row">{s.name}</th>
          {j.assessments.map((a) => { const k = `${a.id}|${s.id}`; const v = j.marks[k] ?? null; const p = j.pending[k];
            return <td key={a.id} className={(v === null ? "empty" : v < 50 ? "low" : "") + (sp.cell === `${a.id}.${s.id}` ? " hit" : "")}>
              <form action={cell}>
                <input type="hidden" name="section" value={section} /><input type="hidden" name="a" value={a.id} /><input type="hidden" name="s" value={s.id} />
                <CellInput id={`c-${a.id}-${s.id}`} value={v} label={`${s.name}, ${a.title}`} invalid={sp.error === "score" && sp.cell === `${a.id}.${s.id}`} />
              </form>
              {p !== undefined && <small className="pend" title="Ждёт подтверждения деканата">{"->"} {p}</small>}
            </td>; })}
          <td className="nb">{s.absences || ""}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="note dim">Пустая клетка: введите балл и нажмите Enter, студент увидит его сразу. Исправить уже выставленную оценку можно только через деканат.</p>
    <details className="box more"><summary><Icon name="plus" />Добавить столбец (контрольная, тест)</summary>
      <form action={addColumn} className="stack">
        <input type="hidden" name="section" value={section} />
        <div className="two"><div className="field"><label htmlFor="ct">Название</label><input id="ct" name="title" required maxLength={80} placeholder="Контрольная 3" /></div>
          <div className="field"><label htmlFor="cd">Дата</label><input id="cd" name="day" type="date" required defaultValue={today()} /></div></div>
        <SubmitButton className="btn pri" pendingText="Добавляем…">Добавить</SubmitButton>
      </form></details>
    <details className="box more"><summary><Icon name="sheet" />Загрузить из Excel</summary>
      <p className="note">Скачайте шаблон группы, заполните столбец score целыми баллами от 0 до 100 и загрузите файл (XLSX до 512 КБ). Каждая строка добавляет новую оценку по курсу.</p>
      <a className="btn sec" href={`/teacher/template?section=${section}`}><Icon name="download" />Шаблон XLSX</a>
      <form action={importExcel} className="stack" encType="multipart/form-data">
        <input type="hidden" name="section" value={section} />
        <div className="field"><label htmlFor="xl">Файл с оценками</label><input id="xl" type="file" name="workbook" accept=".xlsx" required /></div>
        <SubmitButton className="btn sec full" pendingText="Загружаем…"><Icon name="upload" />Загрузить оценки</SubmitButton>
      </form>
    </details>
  </Page>;
}
