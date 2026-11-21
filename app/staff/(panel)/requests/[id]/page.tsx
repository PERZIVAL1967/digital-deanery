import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../lib/guard";
import { requestHistory, requestList } from "../../../../../lib/dal/cifry";
import { requestExtras } from "../../../../../lib/dal/staff";
import { parseMessage, requestName, STATUS_TAG, STEPS, stepOf } from "../../../../../lib/request-ui";
import { transitions } from "../../../../../lib/request-types";
import { fmtWhen } from "../../../../../lib/time";
import { Alert, Page, Tag } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";
import { SubmitButton } from "../../../../../components/client";
import { moveRequest, oneTap } from "../../../actions";

export const metadata = { title: "Заявка" };
const LABEL: Record<string, string> = { in_review: "Взять в работу", needs_info: "Запросить уточнение", ready: "Готова", issued: "Выдана", rejected: "Отклонить" };
const ERR: Record<string, string> = { reason: "Для отказа или уточнения напишите причину: студент её увидит.", conflict: "Заявку уже изменили. Страница обновлена, проверьте статус.",
  invalid: "Проверьте поля формы.", stale: "Справку уже сформировали или заявка закрыта.", unsupported: "Автоматически формируется только справка об обучении." };

export default async function StaffRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { token } = await requireRole("staff");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [[r], events, extra] = await Promise.all([requestList(token, "staff", id), requestHistory(token, "staff", id), requestExtras(token, id)]);
  if (!r || !extra) notFound();
  const sp = await searchParams;
  const next = transitions.staff[r.status] ?? [];
  const step = stepOf(r.status);
  const [k, label] = STATUS_TAG[r.status];
  const canPdf = r.kind === "certificate" && !extra.document_id && (r.status === "submitted" || r.status === "in_review");
  return <Page home="/staff" title={`${requestName(r.kind)}: ${r.name}`} back={{ href: "/staff/requests", label: "Заявки" }}>
    {sp.error && <Alert>{ERR[sp.error] ?? ERR.invalid}</Alert>}
    {sp.ok === "pdf" && <Alert kind="ok">Справка сформирована, заявка готова. Студент получил уведомление, PDF лежит в его документах.</Alert>}
    {sp.ok === "1" && <Alert kind="ok">Статус сохранён. Студент получил уведомление.</Alert>}
    {step >= 0 ? <ol className="steps4">{STEPS.map((n, i) => <li key={n} className={"st" + (i <= step ? " done" : "") + (i === step ? " cur" : "")} aria-current={i === step ? "step" : undefined}>
      <span>{i <= step && <Icon name="check" />}</span>{n}</li>)}</ol> : <p><Tag k={k}>{label}</Tag></p>}
    <div className="box">
      <dl className="ws" style={{ gridTemplateColumns: "120px 1fr" }}>
        <dt>Студент</dt><dd><Link href={`/staff/students/${extra.student_id}`} className="ul">{r.name}</Link>, {extra.group_name}</dd>
        <dt>Статус</dt><dd><Tag k={k}>{label}</Tag></dd><dt>Подана</dt><dd>{fmtWhen(r.created_at)}</dd>
        {parseMessage(r.message).map(([a, b]) => <Fragment key={a}><dt>{a}</dt><dd>{b}</dd></Fragment>)}
      </dl>
    </div>
    {canPdf && <form action={oneTap} className="box onetap">
      <input type="hidden" name="id" value={r.id} />
      <b><Icon name="file-text" /> Справка в одно касание</b>
      <span className="note">PDF соберётся из данных студента (ФИО, курс, группа, форма обучения, зачётная книжка), попадёт в его документы, а заявка станет «Готова».</span>
      <div className="field"><label htmlFor="pickup">Где забрать оригинал</label>
        <input id="pickup" name="pickup" maxLength={300} defaultValue="Оригинал с печатью можно забрать в деканате, каб. 210." /></div>
      <SubmitButton pendingText="Формируем PDF…"><Icon name="check" />Сформировать и подтвердить</SubmitButton>
    </form>}
    {extra.document_id && <a className="btn sec full" href={`/doc/${extra.document_id}`}><Icon name="download" />Справка № {extra.number}, PDF</a>}
    {next.length > 0 ? <form action={moveRequest} className="box">
      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="version" value={r.version} />
      <div className="field"><label htmlFor="msg">Сообщение студенту</label>
        <textarea id="msg" name="message" rows={3} maxLength={2000} placeholder="Например: Можно забрать в деканате, каб. 210, до 27 ноября." /></div>
      <div className="acts">{next.map((s) => <SubmitButton key={s} name="next" value={s} pendingText="Сохраняем…"
        className={s === "rejected" ? "btn danger" : s === "ready" || s === "in_review" || s === "issued" ? "btn pri" : "btn sec"}>{LABEL[s] ?? s}</SubmitButton>)}</div>
      <p className="note dim">Для отказа и уточнения сообщение обязательно.</p>
    </form> : <p className="note">Заявка закрыта, действий нет.</p>}
    <section className="grp"><b>История</b>
      <ul className="facts">{events.map((e) => <li key={e.version}><Tag k={STATUS_TAG[e.status][0]}>{STATUS_TAG[e.status][1]}</Tag>
        <span className="note">{fmtWhen(e.created_at)}{e.version > 0 && e.message ? `: ${e.message}` : ""}</span></li>)}</ul></section>
  </Page>;
}
