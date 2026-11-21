import Link from "next/link";
import { requireRole } from "../../../../lib/guard";
import { notifications } from "../../../../lib/dal/cifry";
import { markAllRead } from "../../../../lib/changes/cifry";
import { toCard } from "../../../../lib/notices";
import { plural } from "../../../../lib/time";
import { Empty, Page, Tag } from "../../../../components/ui";

export const metadata = { title: "Уведомления" };

export default async function Inbox() {
  const { token } = await requireRole("student");
  const list = await notifications(token);
  // opening the inbox marks everything read; the cards still show what was new on this visit
  if (list.some((n) => !n.read_at)) await markAllRead(token);
  const cards = list.map(toCard);
  const fresh = cards.filter((c) => c.unread).length;
  return <Page title="Уведомления" fig={{ num: String(fresh), label: fresh ? `${plural(fresh, "новое", "новых", "новых")} с прошлого раза` : "новых нет" }}>
    {cards.length ? <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>{cards.map((c) => <li key={c.id}>
      <Link href={c.href} className="box">
        <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <b>{c.title}</b>
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>{c.unread && <Tag k="bad">Новое</Tag>}{c.tag && !c.unread && <Tag k={c.tag.k}>{c.tag.text}</Tag>}</span>
        </span>
        <span style={{ fontSize: 13, opacity: .7 }}>{c.when}</span>
        {(c.was || c.now) && <dl className="ws">
          {c.was && <><dt>{c.wasLabel ?? "было"}</dt><dd className={c.wasLabel ? undefined : "was"}>{c.was}</dd></>}
          {c.now && <><dt>{c.nowLabel ?? (c.was ? "стало" : "что")}</dt><dd className="now">{c.now}</dd></>}
        </dl>}
        {c.why && <span className="note"><b>Почему.</b> {c.why}</span>}
        <span className="note">{c.todo}</span>
      </Link>
    </li>)}</ul> : <Empty icon="bell" text="Новых изменений нет - мы напишем, если что-то поменяется." />}
  </Page>;
}
