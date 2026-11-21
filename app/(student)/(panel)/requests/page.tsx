import Link from "next/link";
import { requireRole } from "../../../../lib/guard";
import { documents, requestList } from "../../../../lib/dal/cifry";
import { requestName, STATUS_TAG, stepOf } from "../../../../lib/request-ui";
import { fmtDayMonth, mskDay, plural } from "../../../../lib/time";
import { Empty, Page, Row, Tag } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";

export const metadata = { title: "Мои заявки" };

export default async function Requests() {
  const { token } = await requireRole("student");
  const [rows, docs] = await Promise.all([requestList(token, "student"), documents(token)]);
  const ready = rows.filter((r) => r.status === "ready").length;
  return <Page title="Мои заявки" fig={{ num: String(ready), label: ready === 1 ? "справка готова" : `${plural(ready, "заявка готова", "заявки готовы", "заявок готово")} к выдаче` }}>
    <Link className="btn pri full" href="/requests/new"><Icon name="plus" />Подать заявку</Link>
    {rows.length ? <div className="rows">{rows.map((r) => {
      const [k, text] = STATUS_TAG[r.status];
      const step = stepOf(r.status);
      return <Row key={r.id} href={`/requests/${r.id}`} t={requestName(r.kind)} s={`подана ${fmtDayMonth(mskDay(r.created_at))}${step === 1 && r.status === "needs_info" ? ", нужно уточнение" : ""}`} end={<Tag k={k}>{text}</Tag>} />;
    })}</div> : <Empty icon="file-text" text="Заявок пока нет." action={<Link className="btn sec" href="/requests/new">Подать заявку</Link>} />}
    <div className="rows">
      <Row href="/documents" t="Мои документы" s={`${docs.length} PDF`} />
      <Row href="/ask" t="Вопрос в деканат" s="ответ обычно за день" />
    </div>
  </Page>;
}
