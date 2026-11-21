import { randomUUID } from "node:crypto";
import { requireRole } from "../../../../lib/guard";
import { questions } from "../../../../lib/dal/cifry";
import { fmtWhen } from "../../../../lib/time";
import { FieldError, Page } from "../../../../components/ui";
import { SubmitButton, ToastOnLoad } from "../../../../components/client";
import { ask } from "./actions";

export const metadata = { title: "Вопрос в деканат" };
const TOPICS: [string, string][] = [["timetable", "Расписание"], ["documents", "Справки и документы"], ["stipend", "Стипендия"], ["other", "Другое"]];

export default async function Ask({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { token } = await requireRole("student");
  const sp = await searchParams;
  const thread = await questions(token);
  const err = sp.error === "empty" ? "Напишите вопрос." : sp.error === "long" ? "Вопрос длиннее 2000 знаков. Сократите его." : sp.error ? "Выберите тему и отправьте ещё раз." : null;
  return <Page title="Вопрос в деканат" back={{ href: "/requests", label: "Назад" }}>
    {sp.sent && <ToastOnLoad text="Отправлено. Деканат обычно отвечает за день." />}
    {thread.length ? <div className="msgs" aria-label="Переписка с деканатом">{thread.flatMap((q) => [
      <p key={q.id} className="msg me">{q.body}<small>{TOPICS.find((t) => t[0] === q.topic)?.[1]}, {fmtWhen(q.created_at)}</small></p>,
      q.answer ? <p key={q.id + "a"} className="msg them">{q.answer}<small>Деканат, {fmtWhen(q.answered_at!)}</small></p>
        : <p key={q.id + "w"} className="msg them" style={{ opacity: .75 }}>Деканат ещё не ответил. Обычно отвечают за день.</p>,
    ])}</div> : <p className="note">Здесь будет переписка с деканатом. Ответ придёт в уведомления.</p>}
    <form action={ask} className="stack">
      <input type="hidden" name="key" value={randomUUID()} />
      <div className="field"><label htmlFor="tp">Тема</label>
        <select id="tp" name="topic" defaultValue="timetable">{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="q">Вопрос</label>
        <textarea id="q" name="body" rows={3} required maxLength={2000} placeholder="Например: когда перенесут военный перевод?"
          aria-invalid={err ? true : undefined} aria-describedby={err ? "q-e" : undefined} />
        {err && <FieldError id="q-e">{err}</FieldError>}</div>
      <SubmitButton pendingText="Отправляем…">Отправить вопрос</SubmitButton>
    </form>
  </Page>;
}
