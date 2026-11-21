// Smoke test: drives the running app like a browser without JavaScript (plain form posts, cookies, redirects).
// Usage: BASE_URL=http://127.0.0.1:3000 node scripts/smoke.mjs   (default password: DeaneryDemo2026)
// Meant for a freshly seeded database; most steps also pass on reruns.
const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const PASSWORD = process.env.DEANERY_DEMO_PASSWORD || "DeaneryDemo2026";
const results = [];
const log = (ok, name, detail = "") => {
  results.push({ ok, name });
  console.log(`${ok === true ? "PASS" : ok === "skip" ? "SKIP" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
};
const check = (cond, name, detail) => log(!!cond, name, detail);

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? decode(m[1]) : null; };
const text = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

/** all <form>s with their default fields (hidden inputs, text values, checked radios, selected options) */
function forms(html) {
  return [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(([f]) => {
    const fields = [];
    for (const [tag] of f.matchAll(/<input\b[^>]*>/g)) {
      const name = attr(tag, "name"), type = attr(tag, "type") || "text";
      if (!name || type === "file" || type === "submit") continue;
      if ((type === "radio" || type === "checkbox") && !/\schecked=""/.test(tag)) continue;
      fields.push([name, attr(tag, "value") ?? ""]);
    }
    for (const [, tag, body] of f.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) { const n = attr(tag, "name"); if (n) fields.push([n, decode(body)]); }
    for (const [, tag, body] of f.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const n = attr(tag, "name"); if (!n) continue;
      const opts = [...body.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)];
      const sel = opts.find(([, a]) => /selected/.test(a)) ?? opts[0];
      if (sel) fields.push([n, attr(sel[1], "value") ?? decode(sel[2])]);
    }
    return { html: f, action: attr(f.match(/<form\b[^>]*>/)[0], "action"), fields };
  });
}

class Browser {
  constructor(name) { this.name = name; this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...rest] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
      const expired = rest.some((p) => /max-age=0\b/i.test(p.trim()) || (/^expires=/i.test(p.trim()) && new Date(p.split("=")[1]) < new Date()));
      if (expired || v === "") this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  async request(path, init = {}, hops = 0) {
    const res = await fetch(BASE + path, { ...init, redirect: "manual", headers: { cookie: this.cookieHeader(), ...(init.headers || {}) } });
    this.store(res);
    if ([301, 302, 303, 307, 308].includes(res.status) && hops < 6) {
      const to = new URL(res.headers.get("location"), BASE + path);
      return this.request(to.pathname + to.search, {}, hops + 1);
    }
    return { status: res.status, url: path, html: await res.text() };
  }
  get(path) { return this.request(path); }
  /** submit a form of `page` like a browser without JS: pick it by a marker in its HTML, override fields */
  async submit(page, pick, overrides = {}, file) {
    const form = forms(page.html).find((f) => (typeof pick === "function" ? pick(f) : f.html.includes(pick)));
    if (!form) throw new Error(`form "${pick}" not found on ${page.url}`);
    const fd = new FormData();
    const set = new Map(form.fields);
    for (const [k, v] of Object.entries(overrides)) set.set(k, v);
    for (const [k, v] of set) fd.append(k, v);
    if (file) fd.append(file.name, new Blob([file.content], { type: file.type }), file.filename);
    const target = form.action && form.action !== "" ? form.action : page.url;
    return this.request(target, { method: "POST", body: fd, headers: { origin: BASE } });
  }
  async login(login) {
    const page = await this.get("/login");
    return this.submit(page, 'name="login"', { login, password: PASSWORD });
  }
}

const bell = (html) => Number(html.match(/class="cnt"[^>]*>(\d+)</)?.[1] ?? 0);
const stamp = Date.now().toString(36).slice(-5);

try {
  // 0. anonymous visitor
  const anon = new Browser("anon");
  const a0 = await anon.get("/grades");
  check(a0.url === "/login" && a0.status === 200, "anonymous /grades redirects to /login", `${a0.url} ${a0.status}`);

  // 1. student login + every page
  const A = new Browser("student.demo");
  const home = await A.login("student.demo");
  check(home.url === "/" && home.status === 200 && home.html.includes("до следующей пары"), "student login -> / with big numbers", `${home.url} ${home.status}`);
  // brief: the site must say it is a competition concept (a quiet line on /login, the home and Профиль; no top banner)
  const loginPage = await new Browser("anon2").get("/login");
  check(text(loginPage.html).includes("Концепт для конкурса, не официальный сервис") && text(home.html).includes("Концепт для конкурса, не официальный сервис")
    && !loginPage.html.includes("student.demo"), "concept line on /login and home, no demo logins shown");
  const unreadBefore = bell(home.html);
  console.log(`      bell before: ${unreadBefore}; numbers: ${[...home.html.matchAll(/class="num[^"]*"[^>]*>([^<]+)(?:<small>([^<]*))?/g)].slice(0, 3).map((m) => m[1] + (m[2] ? " " + m[2] : "")).join(" | ")}`);

  const pages = ["/", "/timetable", "/timetable?d=2026-11-20", "/profile", "/grades", "/exams", "/plagiarism", "/moodle", "/requests",
    "/requests/new", "/requests/new/certificate", "/requests/new/leave", "/documents", "/ask", "/news", "/services"];
  const bad = [];
  for (const p of pages) { const r = await A.get(p); if (r.status !== 200 || r.url !== p) bad.push(`${p}=${r.status}`); }
  check(!bad.length, `all ${pages.length} student pages return 200`, bad.join(", "));
  const tt = await A.get("/timetable?d=2026-11-20");
  check(text(tt.html).includes("Новая ауд.") && text(tt.html).includes("Отмена"), "seeded 2026-11-20 changes visible (Новая ауд., Отмена)");
  const news1 = await A.get("/news");
  const firstNews = news1.html.match(/href="(\/news\/[0-9a-f-]{36})"/)?.[1];
  const req0 = (await A.get("/requests")).html.match(/href="(\/requests\/[0-9a-f-]{36})"/)?.[1];
  const r1 = firstNews ? await A.get(firstNews) : { status: 0 };
  const r2 = req0 ? await A.get(req0) : { status: 0 };
  check(r1.status === 200 && r2.status === 200, "detail pages /news/[id] and /requests/[id] return 200");
  const sheet = tt.html.match(/href="(\/timetable\?d=2026-11-20&amp;c=[0-9a-f-]{36})"/)?.[1];
  const sh = sheet ? await A.get(decode(sheet)) : { html: "" };
  check(sh.html.includes('role="dialog"'), "class details sheet renders (?c=id)");

  // 2. request -> staff -> «Готова» -> student sees it + notification
  const form = await A.get("/requests/new/certificate");
  const done = await A.submit(form, 'name="kind"', { where: "В банк", copies: "2", lang: "Русский", comment: `smoke ${stamp}` });
  const reqId = done.url.match(/\/requests\/done\/([0-9a-f-]{36})/)?.[1];
  check(reqId && text(done.html).includes("Принято"), "student submits «Справка об обучении» -> confirmation «Принято»", done.url);
  const again = await A.submit(form, 'name="kind"', { where: "В банк", copies: "2", lang: "Русский", comment: `smoke ${stamp}` });
  check(again.url === done.url, "same form posted twice -> same request (idempotency key)", again.url);

  const S = new Browser("dean.demo");
  const staffHome = await S.login("dean.demo");
  const dh = text(staffHome.html);
  check(staffHome.url === "/staff" && /заяв(ка ждёт|ки ждут|ок ждут) решения/.test(dh) && dh.includes("без ответа") && dh.includes("изменений расписания сегодня") && dh.includes("к выдаче"),
    "dean login -> /staff home with the four numbers", staffHome.url);
  check(staffHome.html.includes('class="k-fab"') && !staffHome.html.includes("cab-nav"), "dean cabinet uses the corner menu, no top menu");
  let sp = await S.get(`/staff/requests/${reqId}`);
  sp = await S.submit(sp, 'name="version"', { next: "in_review", message: "Взяли в работу." });
  check(sp.url.includes("ok=1"), "staff: Подана -> В работе", sp.url);
  sp = await S.submit(sp, 'name="version"', { next: "ready", message: "Можно забрать в деканате, каб. 210, до 27 ноября." });
  check(sp.url.includes("ok=1") && text(sp.html).includes("Готова"), "staff: В работе -> Готова", sp.url);
  const mine = await A.get(`/requests/${reqId}`);
  check(text(mine.html).includes("Готова") && text(mine.html).includes("кабинет, где забрать"), "student sees «Готова» on the request");
  const home2 = await A.get("/");
  check(bell(home2.html) >= 1, "student bell shows unread notifications", `bell=${bell(home2.html)}`);

  // 3. staff moves a class -> student timetable «Новая ауд.» + inbox
  const day = "2026-11-24";
  const firstA = (await A.get(`/timetable?d=${day}&view=list`)).html.match(/href="\/timetable\?d=2026-11-24&amp;c=([0-9a-f-]{36})"/)?.[1];
  let st = await S.get(`/staff/timetable?d=${day}&g=3МЭО-01`);
  const room = `С-${stamp}`;
  st = await S.submit(st, (f) => f.html.includes(`value="${firstA}"`) && f.html.includes('value="move"'), { room, reason: `Смоук-тест ${stamp}` });
  check(st.url.includes("res=ok"), `staff moves student A's first class of ${day} to room ${room}`, st.url);
  const ttA = await A.get(`/timetable?d=${day}`);
  check(text(ttA.html).includes("Новая ауд.") && text(ttA.html).includes(room), "student timetable shows «Новая ауд.» and the new room");

  // 4. staff publishes news -> student sees it
  const title = `Смоук-новость ${stamp}`;
  let sn = await S.get("/staff/news");
  sn = await S.submit(sn, 'name="title"', { title, body: "Проверка публикации новости." });
  check(sn.url.includes("ok=1"), "staff publishes news", sn.url);
  check(text((await A.get("/news")).html).includes(title), "student sees the news in Новости");

  // 5. teacher journal: a new column, a mark in an empty cell -> the student sees it at once
  const T = new Browser("teacher.demo");
  const th = await T.login("teacher.demo");
  check(th.url === "/teacher" && /пар(а|ы)? сегодня/.test(text(th.html)) && th.html.includes('class="k-fab"'), "teacher login -> /teacher home with big numbers and corner menu", th.url);
  const jl = await T.get("/teacher/journal");
  const finSec = [...jl.html.matchAll(/href="\/teacher\/journal\/([0-9a-f-]{36})"[\s\S]*?<\/a>/g)].find((m) => text(m[0]).includes("Финансы") && text(m[0]).includes("Семинар 3МЭО-01"))?.[1];
  let jp = await T.get(`/teacher/journal/${finSec}`);
  check(jp.status === 200 && jp.html.includes('class="jgrid"') && text(jp.html).includes("Александра Миронова"), "teacher opens the journal grid of Финансы, Семинар 3МЭО-01");
  const note = `Смоук ${stamp}`;
  jp = await T.submit(jp, 'name="title"', { title: note, day: "2026-11-21" });
  check(jp.url.includes("ok=column") && text(jp.html).includes(note), "teacher adds a journal column", jp.url);
  const cellPick = (f) => f.html.includes(`aria-label="Александра Миронова, ${note}"`);
  const saved = await T.submit(jp, cellPick, { score: "95" });
  check(saved.url.includes("ok=mark"), "teacher types 95 into an empty cell (published)", saved.url);
  const gr = text((await A.get("/grades")).html);
  check(gr.includes("95") && gr.includes(note), "student grades show 95 with the column title");
  const fix = await T.submit(saved, cellPick, { score: "90" });
  check(fix.url.includes("fix=") && text(fix.html).includes("Исправление опубликованной оценки"), "changing a published cell asks for a reason", fix.url);
  const proposed = await T.submit(fix, 'name="reason"', { reason: "Пересчитала баллы" });
  check(proposed.url.includes("ok=proposed") && !text((await A.get("/grades")).html).includes(`90 ${note}`), "the correction goes to the dean; the student still sees 95", proposed.url);
  // Excel import (Codex's) is kept on the journal page
  const tpl = await fetch(`${BASE}/teacher/template?section=${finSec}`, { headers: { cookie: T.cookieHeader() } });
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await tpl.arrayBuffer());
  const ws = wb.worksheets[0];
  ws.getRow(2).getCell(2).value = 81;
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
  const imp = await T.submit(jp, (f) => f.html.includes('name="workbook"'), {},
    { name: "workbook", filename: "marks.xlsx", content: xlsx, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  check(tpl.status === 200 && /import=(ok|duplicate)/.test(imp.url), "Excel template + import still work on the journal page", imp.url);

  // 6. inbox: the new notifications, then marked read
  const inbox = text((await A.get("/inbox")).html);
  check(inbox.includes("Справка об обучении: готова") && inbox.includes("Новая аудитория") && inbox.includes("Новая оценка: Финансы") && inbox.includes(`Новость: ${title}`),
    "inbox has: request ready, class moved, new grade, news");
  check(bell((await A.get("/")).html) === 0, "opening the inbox marks notifications read (bell = 0)");

  // 7. IDOR: student B cannot read or change student A's request
  const B = new Browser("student.demo2");
  await B.login("student.demo2");
  const idor = await B.get(`/requests/${reqId}`);
  check(idor.status === 404 && idor.html.includes("нет доступа") && !idor.html.includes(`smoke ${stamp}`) && !idor.html.includes("В банк"), "student B gets 404 «нет доступа» on student A's /requests/[id]", `status ${idor.status}`);
  const idor2 = await B.get(`/requests/done/${reqId}`);
  check(idor2.status === 404, "student B gets 404 on student A's /requests/done/[id]", `status ${idor2.status}`);
  const bReqs = await B.get("/requests");
  const bOwn = bReqs.html.match(/href="(\/requests\/[0-9a-f-]{36})"/g)?.map((h) => h.slice(6, -1)) ?? [];
  let forged = null;
  for (const href of bOwn) { const p = await B.get(href); if (p.html.includes('value="withdrawn"')) { forged = await B.submit(p, 'value="withdrawn"', { id: reqId, version: "2" }); break; } }
  const still = text((await A.get(`/requests/${reqId}`)).html);
  if (forged) check(forged.status === 404 && still.includes("Готова"), "student B's forged withdraw of A's request -> 404, A's request unchanged", `status ${forged.status}`);
  else log("skip", "forged withdraw (student B has no submitted request left)");
  const staffAsStudent = await A.get("/staff");
  check(staffAsStudent.url === "/" && !staffAsStudent.html.includes("Очередь заявок"), "student opening /staff is sent home", staffAsStudent.url);

  // 11. teacher attendance -> student and dean views; the dean excuses it
  const absentOf = (html) => Number(text(html).match(/Посещаемость: (\d+) пропуск/)?.[1] ?? 0);
  const excusedOf = (html) => Number(text(html).match(/уважительных пропусков: (\d+)/)?.[1] ?? 0);
  const tc = await T.get("/teacher/classes?d=2026-11-24");
  const finLec = [...tc.html.matchAll(/href="\/teacher\/classes\/([0-9a-f-]{36})"[\s\S]*?<\/a>/g)].find((m) => text(m[0]).includes("Финансы"))?.[1];
  let cp = await T.get(`/teacher/classes/${finLec}`);
  const markPick = (f) => f.html.includes('name="status"') && f.html.includes("Александра Миронова");
  cp = await T.submit(cp, markPick, { status: "present" });
  const g0 = (await A.get("/grades")).html;
  cp = await T.submit(cp, markPick, { status: "absent" });
  check(cp.url.includes("?m=") && /aria-pressed="true"[^>]*aria-label="Нет: Александра Миронова"|aria-label="Нет: Александра Миронова"[^>]*aria-pressed="true"/.test(cp.html.replace(/class="ab absent" /g, "")),
    "teacher marks Александра Миронова absent with one tap", cp.url);
  const g1 = (await A.get("/grades")).html;
  check(absentOf(g1) === absentOf(g0) + 1, "the absence shows in the student's attendance", `${absentOf(g0)} -> ${absentOf(g1)}`);
  const found = await S.get(`/staff/students?q=${encodeURIComponent("Миронова")}`);
  const cardHref = found.html.match(/href="(\/staff\/students\/[0-9a-f-]{36})"/)?.[1];
  let card = await S.get(cardHref);
  const ct = text(card.html);
  check(card.status === 200 && ct.includes("Александра Миронова") && ct.includes("24001") && ct.includes("Финансы") && ct.includes("Справка об обучении"),
    "dean finds the student and opens the card (profile, grades, requests)");
  check(card.html.includes(`value="${finLec}"`), "the teacher's mark shows in the dean's card (absences)");
  card = await S.submit(card, (f) => f.html.includes(`value="${finLec}"`), { reason: "Справка из поликлиники" });
  check(card.url.includes("ok=1") && !card.html.includes(`name="occurrence" value="${finLec}"`), "dean excuses the absence (logged)", card.url);
  check(excusedOf((await A.get("/grades")).html) === excusedOf(g0) + 1, "the student sees one more excused absence");

  // 12. dean edits a grade: the reason is mandatory, the edit is logged, student and teacher are notified
  const gradePick = (f) => f.html.includes('name="course"') && f.html.includes('name="score"') && /value="7[0-9]"|value="9[0-9]"|value="8[0-9]"/.test(f.html);
  const noReason = await S.submit(card, (f) => f.html.includes('name="course"'), { score: "88", reason: "" });
  check(noReason.url.includes("error=reason"), "dean grade edit without a reason is refused", noReason.url);
  const finForm = forms(card.html).find((f) => f.html.includes('name="course"') && f.fields.some(([k, v]) => k === "score" && v === "95"));
  const edited = finForm ? await S.submit(card, (f) => f === finForm || f.html === finForm.html, { score: "88", reason: `Апелляция ${stamp}` }) : { url: "" };
  check(edited.url.includes("ok=1") && text(edited.html).includes(`Апелляция ${stamp}`), "dean sets Финансы 95 -> 88 with a reason, it is in the change log", edited.url);
  const gA = text((await A.get("/grades")).html);
  check(gA.includes("88") && text((await A.get("/inbox")).html).includes("Оценка исправлена: Финансы"), "student sees 88 and the notice «Оценка исправлена»");
  check(text((await T.get("/teacher/inbox")).html).includes("Деканат исправил оценку"), "the teacher is notified of the dean's edit");
  void gradePick;

  // 13. targeted news: only the addressed students see it
  let nw = await S.get("/staff/news");
  const opt = (label) => nw.html.match(new RegExp(`<option value="(group:[0-9a-f-]{36})"[^>]*>${label}<`))?.[1];
  const n01 = `Для 3МЭО-01 ${stamp}`, n02 = `Для 3МЭО-02 ${stamp}`;
  await S.submit(nw, 'name="title"', { title: n01, body: "Адресная новость.", to: opt("Группа 3МЭО-01") });
  nw = await S.get("/staff/news");
  await S.submit(nw, 'name="title"', { title: n02, body: "Адресная новость.", to: opt("Группа 3МЭО-02") });
  const newsA = text((await A.get("/news")).html);
  check(newsA.includes(n01) && !newsA.includes(n02) && !newsA.includes("3МЭО-02: собрание группы"), "group news reaches 3МЭО-01 only (student A sees 01, not 02)");

  // 14. one-tap certificate: PDF from the student's data, downloadable by the student only
  const f2 = await A.get("/requests/new/certificate");
  const done2 = await A.submit(f2, 'name="kind"', { where: "В банк", copies: "1", lang: "Русский", comment: `pdf ${stamp}` });
  const req2 = done2.url.match(/\/requests\/done\/([0-9a-f-]{36})/)?.[1];
  let rq = await S.get(`/staff/requests/${req2}`);
  rq = await S.submit(rq, 'name="pickup"');
  check(rq.url.includes("ok=pdf"), "dean: «Справка в одно касание» -> ready", rq.url);
  const docHref = (await A.get("/documents")).html.match(/href="(\/doc\/[0-9a-f-]{36})"/)?.[1];
  const pdfA = docHref ? await A.get(docHref) : { status: 0, html: "" };
  check(pdfA.status === 200 && pdfA.html.startsWith("%PDF"), "student downloads the generated PDF from Мои документы", docHref);
  const pdfB = docHref ? await B.get(docHref) : { status: 0 };
  check(pdfB.status === 404, "another student gets 404 on that PDF", `status ${pdfB.status}`);

  // 15. timetable week grid (desktop view, server-side ?view=grid)
  const grid = await A.get("/timetable?d=2026-11-24&view=grid");
  const ids = new Set([...grid.html.matchAll(/class="wg-x[^"]*" [^>]*?href="\/timetable\?d=[^"&]+&amp;c=([0-9a-f-]{36})|href="\/timetable\?d=[^"&]+&amp;c=([0-9a-f-]{36})&amp;view=grid"/g)].map((m) => m[1] ?? m[2]));
  check(grid.html.includes('data-view="grid"') && grid.html.includes('class="wgrid"') && text(grid.html).includes("Неделя 2 из 2") && ids.size === 18,
    "week grid of 3МЭО-01 (23-28 Nov) returns all 18 of student A's classes", `${ids.size} classes`);

  const dg = await S.get(`/staff/timetable?d=2026-11-24&g=${encodeURIComponent("3МЭО-02")}&view=grid`);
  const dgIds = new Set([...dg.html.matchAll(/class="wg-x[^"]*"[^>]*href="[^"]*c=([0-9a-f-]{36})/g)].map((m) => m[1]));
  check(dg.html.includes('data-view="grid"') && dgIds.size > 10 && /3МЭО-02 ?, неделя 2 из 2/.test(text(dg.html)), "dean week grid for 3МЭО-02 (group selector)", `${dgIds.size} cells`);
  const tg = await T.get("/teacher/classes?d=2026-11-24&view=grid");
  check(tg.html.includes('class="wgrid"') && /href="\/teacher\/classes\/[0-9a-f-]{36}"[^>]*class="wg-x|class="wg-x[^"]*"[^>]*href="\/teacher\/classes\//.test(tg.html), "teacher week grid of «Мои занятия»");

  // 16. authorisation
  const TA = new Browser("teacher-a");
  const taHome = await TA.login("teacher-a");
  check(taHome.url === "/teacher", "a second teacher (teacher-a, Codex's demo) signs in", taHome.url);
  const other = await TA.get(`/teacher/journal/${finSec}`);
  check(other.status === 404 && !text(other.html).includes("Александра Миронова"), "another teacher gets 404 on Белова's journal", `status ${other.status} ${other.url}`);
  const jp2 = await T.get(`/teacher/journal/${finSec}`);
  const forgedCell = await TA.submit(jp2, cellPick, { score: "5" });
  check(forgedCell.status === 404, "another teacher's forged journal cell (Белова's ids) -> 404", `status ${forgedCell.status}`);
  const forgedAtt = await TA.submit(cp, markPick, { status: "present" });
  check(forgedAtt.status === 404, "another teacher's forged attendance mark -> 404", `status ${forgedAtt.status}`);
  const engA = text((await A.get("/timetable?d=2026-11-24&view=list")).html);
  const foreignOcc = firstA; // Английский, taught by Соколова, not by teacher.demo
  check((await T.get(`/teacher/classes/${foreignOcc}`)).status === 404 && engA.length > 0, "teacher.demo gets 404 on a class they do not teach");
  const forgedOwn = await T.submit(cp, markPick, { occ: foreignOcc, status: "absent" });
  check(forgedOwn.status === 404, "teacher.demo's attendance mark on another teacher's class (forged occ) -> 404", `status ${forgedOwn.status}`);
  const sStaff = await A.get("/staff/students"), sTeach = await A.get("/teacher/journal");
  check(sStaff.url === "/" && sTeach.url === "/" && !sStaff.html.includes("Студенты факультета"), "a student opening /staff/students or /teacher/journal is sent home");
  const forgedExcuse = await A.submit(card, (f) => f.html.includes('name="occurrence"') || f.html.includes('name="course"'), { reason: "x", score: "100" });
  check(forgedExcuse.status === 404, "a student posting a dean action -> 404", `status ${forgedExcuse.status}`);
  const SB = new Browser("staff-b");
  const sbHome = await SB.login("staff-b");
  check(sbHome.url === "/staff", "deanery staff of another faculty (staff-b) sign in", sbHome.url);
  check((await SB.get(cardHref)).status === 404, "deanery staff of another faculty get 404 on the student card");

  // 8. plagiarism upload returns a score
  const pl = await A.get("/plagiarism");
  if (forms(pl.html).some((f) => f.html.includes('name="work"'))) {
    const up = await A.submit(pl, 'name="work"', {}, { name: "file", filename: `esse-${stamp}.docx`, content: "Текст эссе для проверки.", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const pct = text(up.html).match(/(\d{2}) % ?оригинальность|оригинальность: [^%]*/);
    const fig = up.html.match(/class="num[^"]*"[^>]*>(\d+)<small>%/)?.[1];
    check(up.url.includes("done=") && fig, "plagiarism upload returns a score", `${fig ?? "?"} % (${up.url})`);
  } else log("skip", "plagiarism upload: no work left to upload (database already used)");

  // 9. theme cookie
  const night = await A.submit(await A.get("/profile"), 'value="night"', { to: "night" });
  check(A.jar.get("theme") === "night" && /<body class="ph night"/.test(night.html), "theme cookie -> night, rendered on the server");
  await A.submit(await A.get("/profile"), 'value="night"', { to: "day" });
  check(A.jar.get("theme") === "day" && /<body class="ph"/.test((await A.get("/")).html), "theme cookie -> day");

  // 10. logout
  const out = await A.submit(await A.get("/profile"), (f) => f.html.includes("Выйти"));
  check(out.url === "/login" && !A.jar.has("deanery_session"), "logout clears the session", out.url);
} catch (error) {
  log(false, "smoke test crashed", error.stack);
}

const failed = results.filter((r) => r.ok === false).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} failed` : ""} against ${BASE}`);
process.exit(failed ? 1 : 0);
