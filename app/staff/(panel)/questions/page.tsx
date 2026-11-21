import { requireRole } from "../../../../lib/guard";
import { staffQuestions } from "../../../../lib/dal/cifry-staff";
import { fmtWhen, plural } from "../../../../lib/time";
import { Alert, Empty, FieldError, Page, Tag } from "../../../../components/ui";
import { SubmitButton } from "../../../../components/client";
import { answer } from "../../actions";

export const metadata = { title: "Вопросы студентов" };
const TOPIC: Record<string, string> = { timetable: "Расписание", documents: "Справки и документы", stipend: "Стипендия", other: "Другое" };

export default async function Questions({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; stale?: string }> }) {
  const { token } = await requireRole("staff");
  const sp = await searchParams;
  const rows = await staffQuestions(token);
  const open = rows.filter((q) => !q.answer).length;
  return <Page home="/staff" title="Вопросы студентов" fig={{ num: String(open), label: `${plural(open, "вопрос ждёт", "вопроса ждут", "вопросов ждут")} ответа` }}>
    {sp.ok && <Alert kind="ok">Ответ отправлен. Студент увидит его в переписке и в уведомлениях.</Alert>}
    {sp.stale && <Alert>На этот вопрос уже ответили.</Alert>}
    {rows.length ? <div className="stack">{rows.map((q) => <div key={q.id} className="box">
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{q.student}, {q.group_name}</b>{q.answer ? <Tag k="ok">Отвечен</Tag> : <Tag k="bad">Ждёт</Tag>}</span>
      <span style={{ fontSize: 13, opacity: .7 }}>{TOPIC[q.topic]}, {fmtWhen(q.created_at)}</span>
      <p className="msg them" style={{ maxWidth: "100%" }}>{q.body}</p>
      {q.answer ? <p className="msg me" style={{ maxWidth: "100%" }}>{q.answer}<small>{fmtWhen(q.answered_at!)}</small></p>
        : <form action={answer} className="stack">
          <input type="hidden" name="id" value={q.id} />
          <div className="field"><label htmlFor={`a-${q.id}`}>Ответ</label><textarea id={`a-${q.id}`} name="answer" rows={3} required maxLength={2000}
            aria-invalid={sp.error === q.id ? true : undefined} aria-describedby={sp.error === q.id ? `e-${q.id}` : undefined} />
            {sp.error === q.id && <FieldError id={`e-${q.id}`}>Напишите ответ (до 2000 знаков).</FieldError>}</div>
          <SubmitButton pendingText="Отправляем…">Ответить</SubmitButton>
        </form>}
    </div>)}</div> : <Empty icon="message-circle" text="Вопросов пока нет." />}
  </Page>;
}
