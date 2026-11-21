import { requireRole } from "../../../../lib/guard";
import { documents } from "../../../../lib/dal/cifry";
import { fmtDayMonth, plural } from "../../../../lib/time";
import { Empty, Page } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { ToastButton } from "../../../../components/client";

export const metadata = { title: "Мои документы" };

export default async function Documents() {
  const { token } = await requireRole("student");
  const docs = await documents(token);
  return <Page title="Мои документы" back={{ href: "/requests", label: "Назад" }}
    fig={{ num: String(docs.length), label: `${plural(docs.length, "готовый документ", "готовых документа", "готовых документов")}` }}>
    {docs.length ? <div className="rows">{docs.map((d) => d.generated_id
      ? <a key={d.id} className="row" href={`/doc/${d.generated_id}`} target="_blank" rel="noopener">
          <span className="lead" /><span className="t">{d.title}</span><span className="end"><Icon name="download" /></span>
          <span className="s">{fmtDayMonth(d.issued_on)}, PDF, сформирована автоматически</span></a>
      : <ToastButton key={d.id} className="row" text="В концепте файл не скачивается.">
      <span className="lead" /><span className="t">{d.title}</span><span className="end"><Icon name="download" /></span>
      <span className="s">{fmtDayMonth(d.issued_on)}, {d.file_format}</span>
    </ToastButton>)}</div> : <Empty icon="files" text="Готовых документов пока нет. Они появятся, когда деканат выдаст справку." />}
  </Page>;
}
