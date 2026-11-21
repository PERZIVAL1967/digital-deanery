import Link from "next/link";
import { requireRole } from "../../../../lib/guard";
import { staffRequests, OPEN_STATUSES, SLA_DAYS } from "../../../../lib/dal/staff";
import { requestName, STATUS_TAG } from "../../../../lib/request-ui";
import { statuses, type Status } from "../../../../lib/request-types";
import { fmtWhen, plural } from "../../../../lib/time";
import { Empty, Page, Row, Tag } from "../../../../components/ui";

export const metadata = { title: "Заявки" };

export default async function Queue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { token } = await requireRole("staff");
  const sp = await searchParams;
  const all = await staffRequests(token);
  const isOpen = (s: string) => OPEN_STATUSES.includes(s);
  const filter = sp.status && Object.hasOwn(statuses, sp.status) ? sp.status as Status
    : sp.status === "all" ? "all" : sp.status === "overdue" ? "overdue" : "open";
  const rows = all.filter((r) => filter === "all" ? true : filter === "open" ? isOpen(r.status) : filter === "overdue" ? r.overdue : r.status === filter);
  const open = all.filter((r) => isOpen(r.status)).length;
  const count = (s: Status) => all.filter((r) => r.status === s).length;
  const overdue = all.filter((r) => r.overdue).length;
  const tabs: [string, string][] = [["open", `Ждут (${open})`], ["overdue", `Просрочены (${overdue})`], ["submitted", `Новые (${count("submitted")})`],
    ["in_review", `В работе (${count("in_review")})`], ["needs_info", `Уточнение (${count("needs_info")})`], ["ready", `К выдаче (${count("ready")})`],
    ["issued", "Выданы"], ["rejected", "Отклонены"], ["all", "Все"]];
  return <Page home="/staff" title="Заявки" fig={{ num: String(open), label: `${plural(open, "заявка ждёт", "заявки ждут", "заявок ждут")} решения` }}>
    <nav className="filters" aria-label="Фильтр">{tabs.map(([k, l]) =>
      <Link key={k} href={k === "open" ? "/staff/requests" : `/staff/requests?status=${k}`}
        aria-current={filter === k ? "true" : undefined} scroll={false}>{l}</Link>)}</nav>
    {rows.length ? <div className="rows">{rows.map((r) => {
      const [k, text] = STATUS_TAG[r.status as Status];
      return <Row key={r.id} href={`/staff/requests/${r.id}`} t={requestName(r.kind)} s={`${r.name}, ${r.group_name}, ${fmtWhen(r.created_at)}${r.has_pdf ? ", PDF готов" : ""}`}
        end={<>{r.overdue && <Tag k="bad">Просрочена</Tag>}<Tag k={k}>{text}</Tag></>} />;
    })}</div> : <Empty icon="clipboard" text="В этом статусе заявок нет." />}
    <p className="note dim">Просроченной считается заявка, которая ждёт решения дольше {SLA_DAYS} дней.</p>
  </Page>;
}
