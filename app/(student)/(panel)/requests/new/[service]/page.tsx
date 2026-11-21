import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireRole } from "../../../../../../lib/guard";
import { kinds } from "../../../../../../lib/request-types";
import { DAYS, isCertificate, requestName } from "../../../../../../lib/request-ui";
import { Alert, FieldError, Page } from "../../../../../../components/ui";
import { Qty, SubmitButton } from "../../../../../../components/client";
import { submit } from "../../actions";

export const metadata = { title: "Новая заявка" };

export default async function RequestForm({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireRole("student");
  const { service } = await params;
  if (!Object.hasOwn(kinds, service)) notFound();
  const { error } = await searchParams;
  const cert = isCertificate(service);
  const commentErr = error === "comment" ? "Опишите, что нужно, хотя бы одним предложением." : error === "long" ? "Комментарий длиннее 1000 знаков. Сократите его." : null;
  return <Page title={requestName(service)} back={{ href: "/requests/new", label: "Назад" }}>
    <p className="note">{kinds[service]}. Срок: {DAYS[service] ?? "до 3 рабочих дней"}. Когда будет готово, придёт уведомление.</p>
    {(error === "fields" || error === "stale") && <Alert>Проверьте поля формы и отправьте ещё раз.</Alert>}
    <form action={submit} className="stack">
      <input type="hidden" name="key" value={randomUUID()} />
      <input type="hidden" name="kind" value={service} />
      {cert && <>
        <div className="field"><label htmlFor="to">Куда</label>
          <select id="to" name="where" defaultValue={service === "military_certificate" ? "В военкомат" : "По месту требования"}>
            {["По месту требования", "В посольство", "В банк", "Работодателю", "В военкомат"].map((w) => <option key={w}>{w}</option>)}
          </select></div>
        <div className="field"><span className="flabel" id="ql">Экземпляров</span><Qty name="copies" labelledBy="ql" /></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend className="flabel" style={{ marginBottom: 6 }}>Язык</legend>
          <div className="seg2">{["Русский", "Английский"].map((l) => <label key={l}>
            <input type="radio" name="lang" value={l} defaultChecked={l === (service === "certificate_english" ? "Английский" : "Русский")} />{l}</label>)}</div>
        </fieldset>
      </>}
      <div className="field"><label htmlFor="cm">Комментарий{cert ? "" : " (обязательно)"}</label>
        <textarea id="cm" name="comment" rows={cert ? 2 : 4} maxLength={1000} required={!cert}
          placeholder={cert ? "Например: нужна печать на каждой странице" : "Например: отсутствовал 18 ноября по болезни, справка есть"}
          aria-invalid={commentErr ? true : undefined} aria-describedby={commentErr ? "cm-e" : undefined} />
        {commentErr && <FieldError id="cm-e">{commentErr}</FieldError>}
      </div>
      <SubmitButton pendingText="Отправляем…">Отправить заявку</SubmitButton>
    </form>
  </Page>;
}
