import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireRole } from "../../lib/guard";
import { homeData } from "../../lib/home";
import { DeskHome, Pane } from "../../components/home";
import { CornerMenu, HomeLayer, ServiceFolder, SnapPager, ToastHost } from "../../components/client";
import { TopRight, Who } from "../../components/ui";

/**
 * The home (three big numbers on the phone, «Плакат дня» on desktop) lives in this layout, not in the page,
 * so it stays mounted while a section is open: closing a page or pressing Back shows it exactly where it was
 * (same number, folder still open), with no server round trip for the home itself.
 * Pages render into (panel)/layout over it.
 */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const { token } = await requireRole("student");
  const night = (await cookies()).get("theme")?.value === "night";
  const h = await homeData(token);
  const first = h.profile?.name.split(" ")[0] ?? "";
  return <ToastHost>
    <div className="body">
      <HomeLayer>
        <div className="home snap m-only" id="home-m" tabIndex={-1} role="region" aria-label="Главная: три числа дня">
          {h.nums.map((n) => <Pane key={n.lab} n={n} />)}
          <section className="pane" aria-labelledby="svh">
            <h2 className="svh" id="svh">Сервисы</h2>
            <ServiceFolder tiles={h.tiles} />
            <p className="fine">Концепт для конкурса, не официальный сервис. Все данные вымышленные.</p>
          </section>
        </div>
        <div className="n-top m-only">
          <Who name={h.profile?.name ?? ""} sub={`${first}, ${h.profile?.course_year ?? 3} курс`} />
          <TopRight night={night} unread={h.unread} />
        </div>
        <SnapPager count={h.nums.length + 1} />
        <DeskHome h={h} night={night} />
      </HomeLayer>
      {children}
    </div>
    <CornerMenu />
  </ToastHost>;
}
