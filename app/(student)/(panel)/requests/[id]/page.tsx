import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../lib/guard";
import { requestHistory, requestList } from "../../../../../lib/dal/cifry";
import { DAYS, parseMessage, requestName, STATUS_TAG, STEPS, stepOf } from "../../../../../lib/request-ui";
import { fmtDayMonth, mskDay } from "../../../../../lib/time";
import { Alert, Page, Tag } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";
import { SubmitButton, ToastButton } from "../../../../../components/client";
import { studentChange } from "../actions";

export const metadata = { title: "Заявка" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await requireRole("student");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  // Codex's requestScope: only the owner's session can see this row; anyone else gets the same 404
  const [[r], events] = await Promise.all([requestList(token, "student", id), requestHistory(token, "student", id)]);
  if (!r) notFound();
  const { error } = await searchParams;
  const step = stepOf(r.status);
  const ready = r.status === "ready";
  const room = r.last_note?.match(/каб\.\s*(\d+)/)?.[1];
  const note = r.status === "submitted" ? `Заявку возьмут в работу в ближайший рабочий день. Срок: ${DAYS[r.kind] ?? "до 3 рабочих дней"}.` : r.last_note;
  const details = [...parseMessage(r.message), ["Подана", fmtDayMonth(mskDay(r.created_at))] as [string, string]];
  const [k, label] = STATUS_TAG[r.status];
  return <Page title={requestName(r.kind)} back={{ href: "/requests", label: "Назад" }}
    fig={ready && room ? { num: room, label: "кабинет, где забрать", mid: true } : null}>
    {error && <Alert>Статус заявки уже изменился или поле пустое. Обновите страницу и попробуйте снова.</Alert>}
    {step >= 0 ? <ol className="steps4" aria-label="Ход заявки">{STEPS.map((n, i) =>
      <li key={n} className={"st" + (i <= step ? " done" : "") + (i === step ? " cur" : "")} aria-current={i === step ? "step" : undefined}>
        <span>{i <= step && <Icon name="check" />}</span>{n}</li>)}</ol>
      : <p><Tag k={k}>{label}</Tag></p>}
    {note && <div className="box"><span className="note">{note}</span></div>}
    <dl className="ws" style={{ gridTemplateColumns: "110px 1fr" }}>{details.map(([k2, v]) => <Fragment key={k2}><dt>{k2}</dt><dd>{v}</dd></Fragment>)}</dl>
    {events.length > 1 && <details className="more"><summary><Icon name="chevron-down" />История</summary>
      <ul className="facts">{events.map((e) => <li key={e.version}><Tag k={STATUS_TAG[e.status][0]}>{STATUS_TAG[e.status][1]}</Tag><span className="note">{fmtDayMonth(mskDay(e.created_at))}{e.version > 0 && e.message ? `: ${e.message}` : ""}</span></li>)}</ul>
    </details>}
    {ready && <ToastButton className="btn pri full" text="Напомним завтра в 10:00."><Icon name="bell-plus" />Напомнить завтра</ToastButton>}
    {r.status === "submitted" && <form action={studentChange}>
      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="version" value={r.version} /><input type="hidden" name="next" value="withdrawn" />
      <SubmitButton className="btn danger full" pendingText="Отзываем…">Отозвать заявку</SubmitButton>
    </form>}
    {r.status === "needs_info" && <form action={studentChange} className="stack">
      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="version" value={r.version} /><input type="hidden" name="next" value="in_review" />
      <div className="field"><label htmlFor="ans">Ответ деканату</label><textarea id="ans" name="message" rows={3} required maxLength={2000} /></div>
      <SubmitButton pendingText="Отправляем…">Отправить ответ</SubmitButton>
    </form>}
    {r.status === "rejected" && <Link className="btn pri full" href={`/requests/new/${r.kind}`}>Подать заново</Link>}
  </Page>;
}
