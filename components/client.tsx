"use client";
// Small client islands. Each one has a no-JS fallback: links and plain forms keep working without them.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "./icons";
import { hlOf, SECTIONS, THEME_COLOR } from "../lib/sections";

/* ---------- theme ---------- */
export function ThemeButton({ night, variant = "round" }: { night: boolean; variant?: "round" | "seg" }) {
  const [isNight, setNight] = useState(night);
  // the prop may come from a cached page rendered before a theme switch: the body class is the truth
  useEffect(() => setNight(document.body.classList.contains("night")), [night]);
  const apply = (n: boolean) => {
    setNight(n);
    document.body.classList.toggle("night", n);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", n ? THEME_COLOR.night : THEME_COLOR.day));
    document.querySelectorAll<HTMLElement>("[data-theme-sync]").forEach((el) => el.dispatchEvent(new CustomEvent("theme", { detail: n })));
    const body = new FormData();
    body.set("to", n ? "night" : "day");
    fetch("/theme", { method: "POST", body, redirect: "manual" }).catch(() => {});
  };
  useEffect(() => {
    const sync = () => setNight(document.body.classList.contains("night"));
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  if (variant === "seg") {
    return <form action="/theme" method="post" className="seg2" role="group" aria-labelledby="theme-l"
      onSubmit={(e) => { e.preventDefault(); const to = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value"); apply(to === "night"); }}>
      <button type="submit" name="to" value="day" aria-pressed={!isNight}><Icon name="sun" />Дневная</button>
      <button type="submit" name="to" value="night" aria-pressed={isNight}><Icon name="moon" />Ночная</button>
    </form>;
  }
  return <form action="/theme" method="post" className="inline" onSubmit={(e) => { e.preventDefault(); apply(!isNight); }}>
    <input type="hidden" name="to" value={isNight ? "day" : "night"} />
    <button type="submit" className="round" aria-label={isNight ? "Дневная тема" : "Ночная тема"}>
      <Icon name={isNight ? "sun" : "moon"} />
    </button>
  </form>;
}

/* ---------- toast ---------- */
const ToastCtx = createContext<(text: string) => void>(() => {});
export function ToastHost({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: string) => {
    setText(t); setShown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2600);
  }, []);
  return <ToastCtx.Provider value={show}>{children}<div className={shown ? "toast in" : "toast"} role="status" aria-live="polite">{text}</div></ToastCtx.Provider>;
}
export function ToastButton({ text, className, children, label, style }: { text: string; className?: string; children: ReactNode; label?: string; style?: React.CSSProperties }) {
  const show = useContext(ToastCtx);
  return <button type="button" className={className} style={style} aria-label={label} onClick={() => show(text)}>{children}</button>;
}
/** shows a toast once after a redirect (e.g. ?sent=1) */
export function ToastOnLoad({ text }: { text: string }) {
  const show = useContext(ToastCtx);
  useEffect(() => { show(text); }, [show, text]);
  return null;
}

/* ---------- corner menu ---------- */
export type MenuItem = [string, string, IconName, string];
const MENU: MenuItem[] = [
  ["/", "Главная", "house", "#FFFFFF"], ["/timetable", "Расписание", "calendar-days", SECTIONS.timetable.hl],
  ["/grades", "Учёба", "graduation-cap", SECTIONS.grades.hl], ["/requests", "Деканат", "landmark", SECTIONS.requests.hl],
  ["/services", "Всё остальное", "folder", SECTIONS.services.hl], ["/profile", "Профиль", "user", SECTIONS.profile.hl],
];
const SECTION: Record<string, string> = {
  timetable: "/timetable", grades: "/grades", exams: "/grades", plagiarism: "/grades", moodle: "/grades",
  requests: "/requests", documents: "/requests", ask: "/requests", services: "/services", news: "/services",
  inbox: "/services", profile: "/profile",
};
/** the corner menu; the cabinets pass their own items, home and section map (segment after the home -> menu item) */
export function CornerMenu({ items = MENU, sections = SECTION, home = "/" }: { items?: MenuItem[]; sections?: Record<string, string>; home?: string } = {}) {
  const [open, setOpen] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const path = usePathname();
  const rest = home === "/" ? path : path.slice(home.length) || "/";
  const current = path === home ? home : sections[rest.split("/")[1] ?? ""] ?? "";
  useEffect(() => { document.body.classList.toggle("menu", open); }, [open]);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, items.findIndex((m) => m[0] === current));
    // items become visible one by one (staggered transition); focus once the current one is shown
    const t = setTimeout(() => linkRefs.current[idx]?.focus(), 60 + idx * 35);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); fab.current?.focus(); }
      if (e.key === "Tab") { // keep focus inside the open menu
        const list = [...linkRefs.current.filter(Boolean), fab.current] as HTMLElement[];
        const i = list.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey, true); };
  }, [open, current, items]);
  const pos = (i: number) => [Math.max(0, 4 - i) * 6, 72 + i * 58];
  return <nav aria-label="Разделы">
    <div className="k-veil" onClick={() => setOpen(false)} />
    <div id="k-menu">
      {items.map(([href, label, icon, c], i) => {
        const [x, y] = pos(i);
        return <Link key={href} href={href} prefetch={true} scroll={href !== home} className="k-item" tabIndex={open ? 0 : -1} aria-hidden={!open}
          aria-current={href === current ? "page" : undefined} ref={(el) => { linkRefs.current[i] = el; }}
          style={{ ["--c" as string]: c, ["--x" as string]: `${x}px`, ["--y" as string]: `${y}px`, ["--i" as string]: i }}
          onClick={() => setOpen(false)}>
          <span>{label}</span><span className="ic"><Icon name={icon} /></span>
        </Link>;
      })}
    </div>
    <button ref={fab} type="button" className="k-fab" aria-haspopup="true" aria-expanded={open} aria-controls="k-menu"
      aria-label="Разделы" onClick={() => setOpen((o) => !o)}>
      <Icon name="layout-grid" />
    </button>
    <noscript><a className="k-fab" href={(home === "/" ? "" : home) + "/services"} aria-label="Все разделы" style={{ zIndex: 12 }}>☰</a></noscript>
  </nav>;
}

/* ---------- home: snap pager ---------- */
export function SnapPager({ count }: { count: number }) {
  const [on, setOn] = useState(0);
  useEffect(() => {
    const home = document.querySelector<HTMLElement>(".home.snap");
    if (!home) return;
    const f = () => setOn(Math.min(count - 1, Math.round(home.scrollTop / home.clientHeight)));
    home.addEventListener("scroll", f, { passive: true });
    return () => home.removeEventListener("scroll", f);
  }, [count]);
  return <div className="pager m-only" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i} className={i === on ? "on" : undefined} />)}</div>;
}

/* ---------- home: the pink folder ---------- */
export type TileData = { key: string; label: string; sub: string; icon: IconName; color: string; href?: string; toast?: string };

export function TileView({ t, i }: { t: TileData; i: number }) {
  const inner = <><span className="ai"><Icon name={t.icon} /></span>{t.label}<small>{t.sub}</small></>;
  const style = { ["--c" as string]: t.color, ["--i" as string]: i };
  if (t.href) return <Link className="tile" href={t.href} prefetch={true} style={style}>{inner}</Link>;
  return <ToastButton className="tile" style={style} text={t.toast ?? ""}>{inner}</ToastButton>;
}

const FOLDER_KEY = "home:folder";
/** Port of the mock-up's SVC.wire: Web Animations + FLIP. The tiles fall out of the dropping folder. */
export function ServiceFolder({ tiles }: { tiles: TileData[] }) {
  const box = useRef<HTMLDivElement>(null);
  const fold = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const busy = useRef(false);
  const pending = useRef<null | (() => void)>(null);
  useEffect(() => {
    setReady(true);
    try { if (sessionStorage.getItem(FOLDER_KEY) === "1") setOpen(true); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { if (!ready) return; try { sessionStorage.setItem(FOLDER_KEY, open ? "1" : "0"); } catch { /* storage blocked */ } }, [open, ready]);
  // after React commits the new state, run the animation measured on the new layout
  useEffect(() => { const run = pending.current; pending.current = null; run?.(); }, [open]);

  const toggle = () => {
    const b = box.current, f = fold.current;
    if (!b || !f || busy.current) return;
    const ts = [...b.querySelectorAll<HTMLElement>(".tile")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mid = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2];
    const tilt = (i: number) => ((i * 37) % 17) - 8;
    const DROP = 720, ease = (t: number) => 1 - Math.pow(1 - Math.min(1, t), 3);
    const flipFold = (before: DOMRect, fromH: number, toH: number) => {
      if (reduce) return f.getBoundingClientRect();
      const after = f.getBoundingClientRect();
      f.animate([{ transform: `translateY(${before.top - after.top}px)`, height: fromH + "px" }, { transform: "none", height: toH + "px" }],
        { duration: DROP, easing: "cubic-bezier(.33,1,.68,1)" });
      return after;
    };
    busy.current = true;
    if (!open) {
      const before = f.getBoundingClientRect();
      pending.current = () => {
        const af = flipFold(before, 190, 62);
        // each paper leaves the folder where the folder is at that moment of its drop: tucked behind the front,
        // it slides up out of the opening, turns a little and settles into its slot
        if (!reduce) ts.forEach((t, i) => {
          const [tx, ty] = mid(t.getBoundingClientRect());
          const delay = 40 + i * 48, p = ease(delay / DROP), ftop = before.top + (af.top - before.top) * p;
          const ox = before.left + before.width * (.22 + .28 * (i % 3)), oy = ftop + 70;
          const dx = ox - tx, dy = oy - ty, rt = tilt(i);
          t.animate([
            { transform: `translate(${dx}px,${dy}px) rotate(${rt * .5}deg) scale(.86)`, opacity: 0 },
            { transform: `translate(${dx}px,${dy}px) rotate(${rt * .5}deg) scale(.86)`, opacity: 1, offset: .04 },
            { transform: `translate(${dx * .9}px,${dy - 96}px) rotate(${rt}deg) scale(.9)`, offset: .32 },
            { transform: `translate(${dx * .3}px,${dy * .3 - 10}px) rotate(${-rt * .35}deg) scale(.98)`, offset: .72 },
            { transform: "none", opacity: 1 },
          ], { duration: 860, delay, easing: "cubic-bezier(.3,.7,.25,1)", fill: "backwards" });
        });
        setTimeout(() => { busy.current = false; }, reduce ? 0 : 900 + ts.length * 55);
      };
      setOpen(true);
    } else {
      if (reduce) { setOpen(false); busy.current = false; return; }
      const [fx, fy] = mid(f.getBoundingClientRect());
      // collect in reverse order: each paper lifts slightly, glides to the tab and tucks in
      const anims = ts.map((t, i) => {
        const k = ts.length - 1 - i;
        const [tx, ty] = mid(t.getBoundingClientRect());
        const dx = fx - tx, dy = fy - ty, r = tilt(i);
        return t.animate([
          { transform: "none", opacity: 1 },
          { transform: `translate(${dx * .25}px,${dy * .25 - 14}px) rotate(${r * .3}deg) scale(.96)`, opacity: 1, offset: .3 },
          { transform: `translate(${dx * .8}px,${dy * .8}px) rotate(${r * .8}deg) scale(.7)`, opacity: 1, offset: .75 },
          { transform: `translate(${dx}px,${dy}px) rotate(${r}deg) scale(.45)`, opacity: 0 },
        ], { duration: 640, delay: k * 45, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
      });
      Promise.all(anims.map((a) => a.finished)).then(() => {
        const before = f.getBoundingClientRect();
        pending.current = () => { anims.forEach((a) => a.cancel()); flipFold(before, 62, 190); busy.current = false; };
        setOpen(false);
      });
    }
  };

  return <>
    <div ref={box} className={"fbox" + (open ? " open" : "") + (ready ? "" : " nojs")}>
      <button ref={fold} type="button" className="fold" aria-expanded={open} aria-controls="svc-tiles"
        aria-label={open ? "Свернуть папку «Всё остальное»" : "Всё остальное: открыть папку"} onClick={toggle} hidden={!ready}>
        <span className="bk" /><span className="fr"><span className="ftx"><strong>Всё остальное</strong><span className="fsub">{tiles.length} сервисов</span></span>
          <span className="fclose">Свернуть<Icon name="chevron-down" /></span></span>
      </button>
      <div className="tiles" id="svc-tiles">{tiles.map((t, i) => <TileView key={t.key} t={t} i={i} />)}</div>
    </div>
    {ready && !open && <p className="hint">Нажмите на папку.</p>}
  </>;
}

/* ---------- home layer: stays mounted under the pages ---------- */
const SCROLL_KEY = "home:scroll";
/**
 * Wraps the home in (student)/layout. The home is never unmounted while a page is open, so its scroll position
 * (which big number) and the folder state survive Close and the browser Back button by themselves.
 * Also: restores the scroll after a full reload (sessionStorage), hides the covered home on the phone,
 * and refreshes the home numbers in the background when they may be stale.
 */
export function HomeLayer({ children, home = "/" }: { children: ReactNode; home?: string }) {
  const path = usePathname();
  const atHome = path === home;
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ path, at: 0 });
  useLayoutEffect(() => {
    last.current.at = Date.now();
    const root = ref.current;
    if (!root) return;
    const els = [...root.querySelectorAll<HTMLElement>(".home")];
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "[]") as number[];
      els.forEach((el, i) => { if (saved[i]) el.scrollTop = saved[i]; });
    } catch { /* storage blocked or empty */ }
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(els.map((el) => el.scrollTop))); } catch { /* ignore */ } });
    };
    els.forEach((el) => el.addEventListener("scroll", save, { passive: true }));
    return () => { cancelAnimationFrame(raf); els.forEach((el) => el.removeEventListener("scroll", save)); };
  }, []);
  useEffect(() => {
    const prev = last.current.path;
    last.current.path = path;
    if (prev === path) return;
    // the inbox marks notifications read: the bell on the home must follow; otherwise refresh numbers older than a minute
    const stale = Date.now() - last.current.at > 60_000;
    if (prev.startsWith((home === "/" ? "" : home) + "/inbox") || (atHome && stale)) { last.current.at = Date.now(); router.refresh(); }
  }, [path, atHome, router, home]);
  useEffect(() => {
    // phone: the page covers the whole home; keep it out of the tab order and away from screen readers
    const mq = matchMedia("(max-width:1023px)");
    const f = () => { if (ref.current) ref.current.inert = !atHome && mq.matches; };
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [atHome]);
  return <div ref={ref} className={"hlayer" + (atHome ? "" : " under")}>{children}</div>;
}

/** «К содержанию»: the open page if there is one, otherwise the visible home */
export function SkipLink() {
  return <a className="skip" href="#main" onClick={(e) => {
    const t = [...document.querySelectorAll<HTMLElement>(".pg:not(.ghost), #main, .home")].find((el) => el.getClientRects().length);
    if (!t) return;
    e.preventDefault();
    if (!t.hasAttribute("tabindex")) t.tabIndex = -1;
    t.focus();
  }}>К содержанию</a>;
}

/**
 * Leave a static copy of `el` that plays its exit animation, so a closing page/sheet can animate out
 * while the navigation itself happens at once (no waiting before router.replace).
 */
function leaveGhost(el: HTMLElement | null, prep: (g: HTMLElement, src: HTMLElement) => void, ms: number) {
  if (!el?.parentElement || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const g = el.cloneNode(true) as HTMLElement;
  g.removeAttribute("id");
  g.setAttribute("aria-hidden", "true");
  g.inert = true;
  el.parentElement.appendChild(g);
  prep(g, el);
  setTimeout(() => g.remove(), ms);
}

/* ---------- page panel (section colour / desktop expand / scroll reset / focus / exit) ---------- */
const PanelCtx = createContext<{ full: boolean; toggle: () => void }>({ full: false, toggle: () => {} });
export function PanelShell({ children }: { children: ReactNode }) {
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const hl = hlOf(path);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    const h = ref.current?.querySelector<HTMLElement>(".pg-h h1");
    if (h && (document.activeElement === document.body || !document.activeElement?.closest(".pg"))) h.focus({ preventScroll: true });
  }, [path]);
  useLayoutEffect(() => {
    const el = ref.current;
    const born = performance.now();
    // runs when the panel unmounts (page closed, Back to home): its DOM is still there, copy it and slide the copy out
    return () => {
      if (!el || performance.now() - born < 120) return; // React dev double-mount
      const top = el.scrollTop;
      leaveGhost(el, (g) => { g.classList.remove("enter"); g.classList.add("ghost"); g.scrollTop = top; }, 400);
    };
  }, []);
  return <PanelCtx.Provider value={{ full, toggle: () => setFull((f) => !f) }}>
    <div ref={ref} className={"pg enter" + (full ? " full" : "")} id="main" tabIndex={-1}
      style={{ ["--hl" as string]: hl, ["--sec" as string]: hl } as CSSProperties}>{children}</div>
  </PanelCtx.Provider>;
}
/** true while the desktop panel is expanded to full screen */
export const usePanelFull = () => useContext(PanelCtx).full;
export function ExpandButton() {
  const { full, toggle } = useContext(PanelCtx);
  return <button type="button" className="round" aria-pressed={full} onClick={toggle}
    aria-label={full ? "Свернуть в панель" : "Развернуть на весь экран"}><Icon name={full ? "minimize-2" : "maximize-2"} /></button>;
}

/* ---------- class details bottom sheet (drag to close) ---------- */
export function Sheet({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLAnchorElement>(null);
  const closeBtn = useRef<HTMLAnchorElement>(null);
  // the close target is fetched while the sheet is open, so closing is a cache hit
  useEffect(() => { router.prefetch(closeHref); }, [router, closeHref]);
  // the sheet slides down while the navigation runs; when the page re-renders without it, a copy finishes the slide
  const close = useCallback(() => {
    setShown(false);
    router.replace(closeHref, { scroll: false });
  }, [router, closeHref]);
  useLayoutEffect(() => {
    const s = sheet.current, sc = scrim.current;
    const born = performance.now();
    return () => {
      if (performance.now() - born < 120) return;
      for (const el of [sc, s]) leaveGhost(el, (g, src) => {
        const cs = getComputedStyle(src);
        g.classList.remove("in", "drag");
        g.style.transition = "none"; g.style.transform = cs.transform === "none" ? "" : cs.transform; g.style.opacity = cs.opacity;
        g.getBoundingClientRect();
        g.style.transition = ""; g.style.transform = ""; g.style.opacity = "";
        g.style.pointerEvents = "none";
      }, 400);
    };
  }, []);
  useEffect(() => {
    const raf = requestAnimationFrame(() => { setShown(true); closeBtn.current?.focus({ preventScroll: true }); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, [close]);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  return <>
    <Link ref={scrim} href={closeHref} scroll={false} replace className={"scrim" + (shown ? " in" : "")} aria-hidden="true" tabIndex={-1}
      onClick={(e) => { e.preventDefault(); close(); }} />
    <div ref={sheet} className={"sheet" + (shown ? " in" : "")} role="dialog" aria-modal="true" aria-label={title}>
      <div className="grab"
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest("a,button")) return; drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 }; sheet.current?.classList.add("drag"); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (!d || !sheet.current) return; const v = e.clientY - d.y0; d.dy = v > 0 ? v : v * .15; sheet.current.style.transform = `translateY(${d.dy}px)`; }}
        onPointerUp={() => { const d = drag.current; if (!d || !sheet.current) return; drag.current = null; const v = d.dy / Math.max(1, performance.now() - d.t0); sheet.current.classList.remove("drag"); sheet.current.style.transform = ""; if (d.dy > 110 || v > .6) close(); }}
        onPointerCancel={() => { drag.current = null; sheet.current?.classList.remove("drag"); if (sheet.current) sheet.current.style.transform = ""; }}>
        <div className="grab-row"><h2>{title}</h2>
          <Link ref={closeBtn} href={closeHref} scroll={false} replace className="x" aria-label="Закрыть"
            onClick={(e) => { e.preventDefault(); close(); }}><Icon name="x" /></Link>
        </div>
      </div>
      <div className="sheet-body">{children}</div>
    </div>
  </>;
}

/* ---------- forms ---------- */
export function SubmitButton({ children, pendingText, className = "btn pri full", name, value }: {
  children: ReactNode; pendingText: string; className?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} name={name} value={value} aria-disabled={pending}>
    {pending ? pendingText : children}
  </button>;
}

export function Qty({ name, min = 1, max = 5, initial = 1, labelledBy }: { name: string; min?: number; max?: number; initial?: number; labelledBy: string }) {
  const [n, setN] = useState(initial);
  return <div className="qty" role="group" aria-labelledby={labelledBy}>
    <button type="button" aria-label="Меньше" onClick={() => setN((v) => Math.max(min, v - 1))}>−</button>
    <input type="number" name={name} min={min} max={max} value={n} inputMode="numeric" aria-labelledby={labelledBy}
      onChange={(e) => setN(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="field-num" />
    <button type="button" aria-label="Больше" onClick={() => setN((v) => Math.min(max, v + 1))}>+</button>
  </div>;
}

/** plagiarism upload: shows the mock-up's progress bar while the server "checks" the file */
export function UploadProgress() {
  const { pending } = useFormStatus();
  const [w, setW] = useState(0);
  useEffect(() => { if (pending) requestAnimationFrame(() => setW(100)); else setW(0); }, [pending]);
  return pending ? <div className="prog" aria-hidden="true"><span style={{ width: w + "%" }} /></div> : null;
}
