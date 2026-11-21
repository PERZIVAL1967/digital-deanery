import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { ExpandButton, ThemeButton } from "./client";

export const Tag = ({ k, children }: { k: "ok" | "warn" | "bad" | "info"; children: ReactNode }) =>
  <span className={`tag ${k}`}>{children}</span>;

type RowProps = { lead?: ReactNode; t: ReactNode; s?: ReactNode; end?: ReactNode; cls?: string; href?: string; scroll?: boolean };
/** the mock-up's row(): lead | title + subtitle | end (tag or chevron) */
export function Row({ lead, t, s, end, cls, href, scroll }: RowProps) {
  const inner = <>
    <span className="lead">{lead}</span><span className="t">{t}</span>
    <span className="end">{end ?? <Icon name="chevron-right" />}</span>
    {s && <span className="s">{s}</span>}
  </>;
  const className = "row" + (cls ? " " + cls : "");
  return href ? <Link href={href} className={className} prefetch={true} scroll={scroll}>{inner}</Link> : <div className={className}>{inner}</div>;
}

export type Fig = { num: string; unit?: string; label: string; mid?: boolean };
export const Num = ({ fig, hl, cls }: { fig: Fig; hl?: string; cls?: string }) =>
  <span className={"num" + (fig.mid || fig.num.length > 2 ? " mid" : "") + (cls ? " " + cls : "")} style={hl ? { ["--hl" as string]: hl } as CSSProperties : undefined}>
    {fig.num}{fig.unit && <small>{fig.unit}</small>}
  </span>;

/** the page chrome: desktop panel bar (expand on the left, close on the right) and the phone back button.
 *  `home` is the cabinet's home ("/" for students, "/staff", "/teacher"). */
export function PageBar({ home = "/", back }: { home?: string; back?: { href: string; label: string } }) {
  const b = back ?? { href: home, label: "Главная" };
  const nested = b.href !== home;
  // the home is already on the client (it lives in the layout): Close / Back to home are cache hits, no scroll jump
  return <>
    <div className="pbar">
      <span className="pl"><ExpandButton />{nested && <Link className="backb" href={b.href} prefetch={true}><Icon name="chevron-left" />Назад</Link>}</span>
      <Link className="round" href={home} aria-label="Закрыть" prefetch={true} scroll={false}><Icon name="x" /></Link>
    </div>
    <Link className="backb mb" href={b.href} prefetch={true} scroll={nested}><Icon name="chevron-left" />{nested ? "Назад" : b.label}</Link>
  </>;
}

/**
 * A student page: the chrome, then the big-number header of the mock-up. Its highlight colour comes from
 * the section of the URL (lib/sections.ts via PanelShell); `hl` only overrides it.
 */
export function Page({ title, fig, hl, back, home, head, children }: {
  title: string; fig?: Fig | null; hl?: string; back?: { href: string; label: string }; home?: string; head?: ReactNode; children: ReactNode;
}) {
  return <div className="pg-anim">
    <PageBar back={back} home={home} />
    <div className="pg-in" style={hl ? { ["--hl" as string]: hl } as CSSProperties : undefined}>
      <div className={"pg-h" + (head ? " has-x" : "")}>
        {head && <div className="pg-x">{head}</div>}
        <h1 tabIndex={-1}>{title}</h1>
        {fig && <><Num fig={fig} /><span className="flab">{fig.label}</span></>}
      </div>
      {children}
    </div>
  </div>;
}

export function TopRight({ night, unread, inbox = "/inbox" }: { night: boolean; unread: number; inbox?: string }) {
  return <div className="tbtns">
    <ThemeButton night={night} />
    <Link href={inbox} className="round" aria-label={unread ? `Уведомления, ${unread} ${unread === 1 ? "новое" : "новых"}` : "Уведомления"}>
      <Icon name="bell" />{unread > 0 && <span className="cnt" aria-hidden="true">{unread}</span>}
    </Link>
  </div>;
}

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

export function Who({ name, sub, href = "/profile" }: { name: string; sub: string; href?: string }) {
  return <Link href={href} prefetch={true} className="who"><b aria-hidden="true">{initials(name)}</b>{sub}</Link>;
}

export function Empty({ icon = "inbox", text, action }: { icon?: IconName; text: string; action?: ReactNode }) {
  return <div className="empty-state"><Icon name={icon} /><p className="note">{text}</p>{action}</div>;
}

export function Alert({ kind = "bad", children }: { kind?: "bad" | "ok"; children: ReactNode }) {
  return <p className={`alert ${kind}`} role={kind === "bad" ? "alert" : "status"}><Icon name={kind === "bad" ? "alert" : "check"} /><span>{children}</span></p>;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return <p className="err" id={id}><Icon name="alert" /><span>{children}</span></p>;
}

/** skeleton rows in the shape of the real content; they fade in only after 300 ms */
export function Skeleton({ rows = 4, big = true, home }: { rows?: number; big?: boolean; home?: string }) {
  // the chrome is shown at once, in the same place as on the page, so nothing jumps when the page arrives
  return <><PageBar home={home} /><div className="pg-in skel" aria-busy="true" aria-label="Загрузка">
    <div className="pg-h"><span className="sk" style={{ width: 120, height: 18 }} />{big && <span className="sk" style={{ width: 180, height: 96, marginTop: 6 }} />}</div>
    <div className="rows">{Array.from({ length: rows }, (_, i) => <div className="row" key={i}><span className="sk" style={{ width: 40, height: 16 }} /><span className="sk" style={{ height: 16, width: `${60 + ((i * 17) % 30)}%` }} /><span /></div>)}</div>
  </div></>;
}
