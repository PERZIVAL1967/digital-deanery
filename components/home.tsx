import Link from "next/link";
import type { CSSProperties } from "react";
import type { BigNumber } from "../lib/home";
import type { homeData } from "../lib/home";
import { cycleWeek, fmtLong, loc, mskTime } from "../lib/time";
import { Icon } from "./icons";
import { TileView } from "./client";
import { Num, TopRight, Who } from "./ui";

type Home = Awaited<ReturnType<typeof homeData>>;

export function BigDet({ n, cls = "det" }: { n: BigNumber; cls?: string }) {
  if (!n.detNode) return <p className={cls}>{n.det}</p>;
  const d = n.detNode;
  return <p className={cls}>{d.course}, {d.when}. {d.was
    ? <>Новая аудитория: <s aria-label={`было ${d.was}`}>{d.was}</s> {d.now}.</>
    : <>{d.now.charAt(0).toUpperCase() + d.now.slice(1)}.</>}</p>;
}

/** desktop ≥1024: «Плакат дня» - the hero number with today's classes stacked under it (left), the two
 *  other numbers stacked (right), «Всё остальное» placed by the svc-a|b|c class (see globals.css) */
export function DeskHome({ h, night }: { h: Home; night: boolean }) {
  const [first, ...rest] = h.nums;
  const now = Date.now();
  return <div className="home dk1 d-only svc-b">
    <div className="dtop">
      <Who name={h.profile?.name ?? ""} sub={`${h.profile?.name ?? ""}, ${h.profile?.group_name ?? ""}`} />
      <TopRight night={night} unread={h.unread} />
    </div>
    <div className="hero">
      <Link href={first.chip.href} prefetch={true}><span className="lab">{first.lab}</span><Num fig={first.fig} hl={first.hl} cls="" /></Link>
      <div className="today">
        <span className="lab">Сегодня, {fmtLong(h.day)}, неделя {cycleWeek(h.day)} из 2</span>
        {h.todays.length ? <div className="tline">{h.todays.map((c) => {
          const going = c.status !== "cancelled" && c.starts_at.getTime() <= now && c.ends_at.getTime() > now;
          const moved = c.status === "moved";
          return <Link key={c.id} prefetch={true} scroll={false} href={`/timetable?d=${h.day}&c=${c.id}`}
            className={"tc" + (c.status === "cancelled" ? " cancel" : moved ? " moved" : "") + (going ? " now" : "")}>
            <b>{mskTime(c.starts_at)}</b><span>{c.course}</span>
            <small>{loc(c.room)}{moved ? ", новая" : ""}{c.status === "cancelled" ? ", отмена" : ""}{going ? ", идёт" : ""}</small>
          </Link>;
        })}</div> : <p className="note">Сегодня занятий нет.</p>}
      </div>
    </div>
    <div className="pair">{rest.map((n) => <Link key={n.lab} href={n.chip.href} prefetch={true} className="poster">
      <Num fig={n.fig} hl={n.hl} /><span><span className="lab">{n.lab}</span><BigDet n={n} /></span>
    </Link>)}</div>
    <div className="svc"><span className="lab">Всё остальное</span>
      <div className="tiles">{h.tiles.map((t, i) => <TileView key={t.key} t={t} i={i} />)}</div>
    </div>
    <p className="fine">Концепт для конкурса, не официальный сервис. Все данные вымышленные.</p>
  </div>;
}

/** mobile: one big number per screen, snap scrolling */
export function Pane({ n }: { n: BigNumber }) {
  return <section className="pane" style={{ ["--hl" as string]: n.hl } as CSSProperties}>
    <span className="lab">{n.lab}</span><Num fig={n.fig} hl={n.hl} />
    <BigDet n={n} />
    <Link className="chip" href={n.chip.href} prefetch={true}><Icon name={n.chip.icon} />{n.chip.label}</Link>
  </section>;
}
