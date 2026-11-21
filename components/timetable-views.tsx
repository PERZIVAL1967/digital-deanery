"use client";
// «Список / Сетка» of the timetables (student, dean, teacher). The server renders both views; this island picks one.
// The grid exists only when the desktop panel is expanded to full screen (CSS hides it and the switch otherwise):
// the narrow panel and the phone are always the list. In full screen: ?view= in the URL > the choice remembered in
// this browser > the grid.
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePanelFull } from "./client";

type View = "list" | "grid";
const KEY = "timetable:view:full";
const Ctx = createContext<{ view: View; choose: (v: View) => void; hrefs: Record<View, string> }>({
  view: "list", choose: () => {}, hrefs: { list: "", grid: "" },
});

export function TimetableViews({ initial, hrefs, children }: { initial: View | null; hrefs: Record<View, string>; children: ReactNode }) {
  const full = usePanelFull();
  const [fromUrl, setFromUrl] = useState<View | null>(initial);
  const [saved, setSaved] = useState<View | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setFromUrl(initial), [initial]);
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === "grid" || v === "list") setSaved(v); } catch { /* storage blocked */ }
    setReady(true);
  }, []);
  // before hydration the URL decides (no-JS, smoke); then: full screen -> choice or grid, narrow panel -> list
  const view: View = !ready ? initial ?? "list" : full ? fromUrl ?? saved ?? "grid" : "list";
  const choose = (v: View) => {
    setSaved(v);
    setFromUrl(null);
    try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ }
  };
  return <Ctx.Provider value={{ view, choose, hrefs }}><div className="ttv" data-view={view}>{children}</div></Ctx.Provider>;
}

export function ViewSwitch() {
  const { view, choose, hrefs } = useContext(Ctx);
  return <div className="seg2 tt-switch" role="group" aria-label="Вид расписания">
    {(["list", "grid"] as const).map((v) => <Link key={v} href={hrefs[v]} scroll={false} replace aria-pressed={view === v}
      onClick={(e) => { e.preventDefault(); choose(v); }}>{v === "list" ? "Список" : "Сетка"}</Link>)}
  </div>;
}

/** the switch lives in the page header, outside the views: it reads the same state through the provider */
export function ViewOnly({ v, children }: { v: View; children: ReactNode }) {
  return <div className={"tt-" + v}>{children}</div>;
}
