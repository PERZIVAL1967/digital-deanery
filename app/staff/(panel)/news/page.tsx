import { randomUUID } from "node:crypto";
import { requireRole } from "../../../../lib/guard";
import { newsTargets, staffNewsTargeted } from "../../../../lib/dal/staff";
import { fmtWhen } from "../../../../lib/time";
import { Alert, Empty, FieldError, Page, Tag } from "../../../../components/ui";
import { SubmitButton } from "../../../../components/client";
import { publishNews } from "../../actions";

export const metadata = { title: "Новости" };

export default async function StaffNews({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { token } = await requireRole("staff");
  const sp = await searchParams;
  const [rows, targets] = await Promise.all([staffNewsTargeted(token), newsTargets(token)]);
  const groups: [string, string][] = [["stream", "Поток"], ["group", "Академические группы"], ["section", "Языковые группы"]];
  return <Page home="/staff" title="Новости и адресные объявления" fig={{ num: String(rows.length), label: "опубликовано" }}>
    {sp.ok && <Alert kind="ok">Опубликовано. Уведомление получили только студенты выбранного адресата.</Alert>}
    <form action={publishNews} className="box">
      <b>Новое объявление</b>
      <input type="hidden" name="id" value={randomUUID()} />
      <div className="field"><label htmlFor="to">Кому</label>
        <select id="to" name="to" defaultValue="faculty">
          <option value="faculty">Весь факультет</option>
          {groups.map(([k, l]) => <optgroup key={k} label={l}>{targets.filter((t) => t.scope === k).map((t) =>
            <option key={t.id} value={`${t.scope}:${t.id}`}>{t.title}</option>)}</optgroup>)}
        </select></div>
      <div className="field"><label htmlFor="t">Заголовок</label><input id="t" name="title" required maxLength={120}
        aria-invalid={sp.error === "title" ? true : undefined} aria-describedby={sp.error === "title" ? "t-e" : undefined} />
        {sp.error === "title" && <FieldError id="t-e">Нужен заголовок до 120 знаков.</FieldError>}</div>
      <div className="field"><label htmlFor="b">Текст</label><textarea id="b" name="body" rows={4} required maxLength={2000}
        aria-invalid={sp.error === "body" ? true : undefined} aria-describedby={sp.error === "body" ? "b-e" : undefined} />
        {sp.error === "body" && <FieldError id="b-e">Нужен текст до 2000 знаков.</FieldError>}</div>
      <SubmitButton pendingText="Публикуем…">Опубликовать</SubmitButton>
    </form>
    {rows.length ? <div className="rows">{rows.map((n) => <div key={n.id} className="row plain">
      <span className="t">{n.title}</span><span className="end"><Tag k="info">{n.target ?? "Факультет"}</Tag></span>
      <span className="s">{fmtWhen(n.published_at)}. {n.body}</span></div>)}</div> : <Empty icon="newspaper" text="Новостей пока нет." />}
  </Page>;
}
