import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cookies } from "next/headers";
import type { BigNumber } from "../lib/home";
import { CornerMenu, HomeLayer, ServiceFolder, SnapPager, TileView, ToastHost, type MenuItem, type TileData } from "./client";
import { Pane, BigDet } from "./home";
import { Num, TopRight, Who } from "./ui";

/** a line of the hero list on the desktop home (today's classes, the oldest requests) */
export type CabItem = { key: string; href: string; lead: string; title: string; sub: string; cls?: string };

export type CabHome = {
  who: { name: string; sub: string }; unread: number;
  first: BigNumber; list: { title: string; items: CabItem[]; empty: string };
  rest: BigNumber[]; tiles: TileData[];
};

/**
 * The shell of the dean's and teacher's cabinets: the same structure as the student app.
 * The home (big numbers, «Всё остальное») lives in the layout and stays mounted; pages open over it as the framed
 * side panel on desktop and full screen on the phone; the corner menu is the only navigation.
 */
export async function CabinetShell({ home, h, menu, sections, children }: {
  home: "/staff" | "/teacher"; h: CabHome; menu: MenuItem[]; sections: Record<string, string>; children: ReactNode;
}) {
  const night = (await cookies()).get("theme")?.value === "night";
  const nums = [h.first, ...h.rest];
  return <ToastHost>
    <div className="body">
      <HomeLayer home={home}>
        <div className="home snap m-only" tabIndex={-1} role="region" aria-label="Главная: числа дня">
          {nums.map((n) => <Pane key={n.lab} n={n} />)}
          <section className="pane" aria-labelledby="svh">
            <h2 className="svh" id="svh">Сервисы</h2>
            <ServiceFolder tiles={h.tiles} />
            <p className="fine">Концепт для конкурса, не официальный сервис. Все данные вымышленные.</p>
          </section>
        </div>
        <div className="n-top m-only">
          <Who name={h.who.name} sub={h.who.sub} href={`${home}/profile`} />
          <TopRight night={night} unread={h.unread} inbox={`${home}/inbox`} />
        </div>
        <SnapPager count={nums.length + 1} />
        <div className="home dk1 d-only svc-b cabh">
          <div className="dtop">
            <Who name={h.who.name} sub={h.who.sub} href={`${home}/profile`} />
            <TopRight night={night} unread={h.unread} inbox={`${home}/inbox`} />
          </div>
          <div className="hero">
            <Link href={h.first.chip.href} prefetch={true}><span className="lab">{h.first.lab}</span><Num fig={h.first.fig} hl={h.first.hl} cls="" /></Link>
            <div className="today">
              <span className="lab">{h.list.title}</span>
              {h.list.items.length ? <div className="tline">{h.list.items.map((c) =>
                <Link key={c.key} prefetch={true} href={c.href} className={"tc" + (c.cls ? " " + c.cls : "")}>
                  <b>{c.lead}</b><span>{c.title}</span><small>{c.sub}</small>
                </Link>)}</div> : <p className="note">{h.list.empty}</p>}
            </div>
          </div>
          <div className="pair">{h.rest.map((n) => <Link key={n.lab} href={n.chip.href} prefetch={true} className="poster"
            style={{ ["--hl" as string]: n.hl } as CSSProperties}>
            <Num fig={n.fig} hl={n.hl} /><span><span className="lab">{n.lab}</span><BigDet n={n} /></span>
          </Link>)}</div>
          <div className="svc"><span className="lab">Всё остальное</span>
            <div className="tiles">{h.tiles.map((t, i) => <TileView key={t.key} t={t} i={i} />)}</div>
          </div>
          <p className="fine">Концепт для конкурса, не официальный сервис. Все данные вымышленные.</p>
        </div>
      </HomeLayer>
      {children}
    </div>
    <CornerMenu items={menu} sections={sections} home={home} />
  </ToastHost>;
}

