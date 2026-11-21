// Pages shared by the dean's and teacher's cabinets: «Всё остальное», profile (theme, sign out), notifications.
import { cookies } from "next/headers";
import type { CabHome } from "./cabinet";
import { TileView, ThemeButton } from "./client";
import { Empty, Page, Tag, initials } from "./ui";
import { Icon } from "./icons";
import { fmtWhen } from "../lib/time";
import { logout } from "../app/actions";

type Home = "/staff" | "/teacher";

export function CabServices({ home, h }: { home: Home; h: CabHome }) {
  return <Page home={home} title="Всё остальное" fig={{ num: String(h.tiles.length), label: "разделов" }}>
    <div className="tiles">{h.tiles.map((t, i) => <TileView key={t.key} t={t} i={i} />)}</div>
  </Page>;
}

export async function CabProfile({ home, name, sub, rows }: { home: Home; name: string; sub: string; rows: [string, string][] }) {
  const night = (await cookies()).get("theme")?.value === "night";
  return <Page home={home} title="Профиль">
    <div className="pcover"><i aria-hidden="true">{initials(name)}</i><div><strong>{name}</strong><small>{sub}</small></div></div>
    <div className="field"><span className="flabel" id="theme-l">Тема</span><ThemeButton night={night} variant="seg" /></div>
    <div className="pfs"><section><h3>Учётная запись</h3><dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section></div>
    <form action={logout}><button type="submit" className="btn sec full"><Icon name="log-out" />Выйти</button></form>
    <p className="note dim">Все данные вымышленные. Это концепт для конкурса, не официальный сервис.</p>
  </Page>;
}

type Notice = { id: string; kind: string; payload: Record<string, string | number | boolean | null>; created_at: Date; read_at: Date | null };
const when = (iso: unknown) => typeof iso === "string" ? fmtWhen(new Date(iso)) : "";
function text(n: Notice): [string, string, "ok" | "warn" | "bad" | "info"] {
  const p = n.payload;
  switch (n.kind) {
    case "resit_result": return [`Пересдача: ${p.student}, ${p.course}`, p.status === "absent" ? "Студент не явился." : `Результат ${p.score} из 100.`, p.status === "passed" ? "ok" : "bad"];
    case "grade_dean": return [`Деканат исправил оценку: ${p.student}`, `${p.course}: ${p.old} -> ${p.new}. Причина: ${p.reason}`, "warn"];
    case "resit_assigned": return [`Вы экзаменатор на пересдаче: ${p.student}, ${p.group}`, `${p.course}, ${when(p.at)}, ауд. ${p.room}. Результат внесите в разделе «Пересдачи».`, "info"];
    case "proposal_approved": return [`Деканат принял исправление: ${p.student}`, `${p.course}, ${p.title}: теперь ${p.new}.`, "ok"];
    case "proposal_rejected": return [`Деканат отклонил исправление: ${p.student}`, `${p.course}, ${p.title}. ${p.note ?? ""}`, "bad"];
    case "request_answered": return [p.done ? "Деканат выполнил запрос" : "Деканат ответил на запрос", `${p.answer}`, p.done ? "ok" : "warn"];
  }
  return ["Уведомление", "", "info"];
}

export function CabInbox({ home, list }: { home: Home; list: Notice[] }) {
  const fresh = list.filter((n) => !n.read_at).length;
  return <Page home={home} title="Уведомления" fig={{ num: String(fresh), label: fresh ? "новых" : "новых нет" }}>
    {list.length ? <ul className="stack plain-list">{list.map((n) => { const [t, s, k] = text(n); return <li key={n.id} className="box">
      <span className="spread"><b>{t}</b>{!n.read_at ? <Tag k="bad">Новое</Tag> : <Tag k={k}>{fmtWhen(n.created_at)}</Tag>}</span>
      <span className="note">{s}</span>
    </li>; })}</ul> : <Empty icon="bell" text="Уведомлений пока нет." />}
  </Page>;
}
