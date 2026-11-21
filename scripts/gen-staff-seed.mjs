// Generates db/103_staff_seed.sql: the fictional поток of three groups (3МЭО-01..03, 90 students),
// 12 language groups, the timetable of 3МЭО-02/03 placed without clashes, grades, absences, requests.
// Deterministic (seeded PRNG), so the generated SQL is reviewed and committed like any migration.
// Usage: node scripts/gen-staff-seed.mjs > db/103_staff_seed.sql
// All names are invented combinations of common Russian first names and surnames.

let seed = 20261121;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const q = (s) => s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;

// ---------- the 3МЭО-01 grid of 101 (week 0 = both weeks; wd 1 = Tuesday ... 5 = Saturday) ----------
const GRID01 = [
  [0,1,0,"Английский первый","Семинар","2061","Соколова Е.А."],
  [1,1,1,"Теория международных экономических отношений","Лекция","зал 4","Громов И.В."],
  [2,1,1,"Финансы","Лекция","зал 4","Белова О.Н."],
  [0,1,2,"Испанский второй","Семинар","233","Ортега Л.П."],
  [1,1,3,"Экономика Европейского Союза и Великобритании","Семинар","зал 4","Ершов А.М."],
  [2,1,3,"Экономика стран Латинской Америки","Семинар","2049","Ершов А.М."],
  [0,1,4,"Военный перевод","Семинар","онлайн","Военный учебный центр"],
  [0,2,1,"Мировой финансовый рынок","По выбору","3072","Кравец К.А."],
  [1,2,2,"Международная экономическая интеграция","Лекция","зал 4","Миронец Т.И."],
  [2,2,2,"Экономическая политика России","Лекция","зал 4","Зотова З.А."],
  [1,2,3,"Теория международной экономики","Семинар","4010","Громов И.В."],
  [2,2,3,"Финансы","Семинар","4010","Белова О.Н."],
  [0,3,0,"Учет во внешнеэкономической деятельности и отчетность","Семинар","2011","Кузнецова Т.Р."],
  [0,3,1,"Испанский второй","Семинар","4051","Ортега Л.П."],
  [0,3,2,"Английский первый","Семинар","4049","Соколова Е.А."],
  [0,3,3,"Военный перевод","Семинар","онлайн","Военный учебный центр"],
  [1,4,1,"Международные экономические отношения","Семинар","2075","Миронец Т.И."],
  [2,4,1,"Экономическая политика России","Семинар","2075","Зотова З.А."],
  [0,4,2,"Налоги и налогообложение","Семинар","3049","Кравец К.А."],
  [0,4,3,"Английский первый","Семинар","4046","Ветров А.Ю."],
  [1,4,5,"Военный перевод","Семинар","онлайн","Военный учебный центр"],
  [0,5,0,"Военный перевод","Семинар","онлайн","Военный учебный центр"],
  [0,5,1,"Испанский второй","Семинар","233","Ортега Л.П."],
  [0,5,2,"Английский первый","Семинар","1051","Ветров А.Ю."],
].map(([week, wd, slot, course, kind, room, teacher]) => ({ week, wd, slot, course, kind, room, teacher }));

const ENGLISH = "Английский первый";
const GROUPS = ["3МЭО-01", "3МЭО-02", "3МЭО-03"];
const ROOMS = ["1012", "1018", "1024", "1105", "2103", "2108", "3015", "3021", "3110", "4002", "4105", "4110", "2201", "2207", "3204", "3210"];
const NEW_TEACHERS = [["Лисицына Н.В.", "lisitsyna@example.org"], ["Корнеева М.С.", "korneeva@example.org"], ["Фадеев Д.Р.", "fadeev@example.org"]];
const LANG_TEACHERS = {
  "3МЭО-01": [null, "Лисицына Н.В.", "Корнеева М.С.", "Фадеев Д.Р."], // group 1 keeps Соколова / Ветров of 101
  "3МЭО-02": ["Белова О.Н.", "Соколова Е.А.", "Ветров А.Ю.", "Лисицына Н.В."],
  "3МЭО-03": ["Корнеева М.С.", "Фадеев Д.Р.", "Соколова Е.А.", "Ветров А.Ю."],
};

// ---------- occupancy over the two-week cycle ----------
const busy = { t: new Set(), r: new Set(), g: new Set() };
const weeks = (w) => (w === 0 ? [1, 2] : [w]);
const key = (w, wd, s, x) => `${w}|${wd}|${s}|${x}`;
const free = (kind, w, wd, s, x) => weeks(w).every((ww) => !busy[kind].has(key(ww, wd, s, x)));
const take = (kind, w, wd, s, x) => weeks(w).forEach((ww) => busy[kind].add(key(ww, wd, s, x)));

for (const r of GRID01) {
  take("t", r.week, r.wd, r.slot, r.teacher);
  take("r", r.week, r.wd, r.slot, r.room);
  const groups = r.kind === "Лекция" || r.kind === "По выбору" ? GROUPS : ["3МЭО-01"];
  groups.forEach((g) => take("g", r.week, r.wd, r.slot, g));
}

const placed = []; // {group, label, kind, lang_no, course, week, wd, slot, room, teacher}
const roomFor = (w, wd, s, prefer) => [prefer, ...ROOMS].find((rm) => rm && free("r", w, wd, s, rm));

// 3МЭО-01 language groups 2..4: same times as group 1, other teachers and rooms
for (const r of GRID01.filter((x) => x.course === ENGLISH)) {
  for (let n = 2; n <= 4; n++) {
    const teacher = LANG_TEACHERS["3МЭО-01"][n - 1];
    if (!free("t", r.week, r.wd, r.slot, teacher)) throw new Error("teacher clash 01 " + teacher);
    const room = roomFor(r.week, r.wd, r.slot, null);
    take("t", r.week, r.wd, r.slot, teacher); take("r", r.week, r.wd, r.slot, room);
    placed.push({ ...r, group: "3МЭО-01", label: `Языковая группа 3МЭО-01/${n}`, kind: "language", lang_no: n, course: ENGLISH, room, teacher });
  }
}

const perDay = new Map();
const dayLoad = (g, w, wd) => Math.max(...weeks(w).map((ww) => perDay.get(`${g}|${ww}|${wd}`) ?? 0));
const addLoad = (g, w, wd) => weeks(w).forEach((ww) => perDay.set(`${g}|${ww}|${wd}`, (perDay.get(`${g}|${ww}|${wd}`) ?? 0) + 1));
for (const r of GRID01) if (r.kind !== "Лекция" && r.kind !== "По выбору") addLoad("3МЭО-01", r.week, r.wd);

function candidates(r, off) {
  const out = [];
  for (let dd = 0; dd < 5; dd++) for (let ds = 0; ds < 6; ds++)
    out.push([1 + ((r.wd - 1 + dd) % 5), (r.slot + off + ds) % 6]);
  return out;
}

for (const [gi, g] of [[1, "3МЭО-02"], [2, "3МЭО-03"]]) {
  const off = gi === 1 ? 2 : 4;
  // group seminars
  for (const r of GRID01.filter((x) => x.kind === "Семинар" && x.course !== ENGLISH)) {
    const spot = candidates(r, off).find(([wd, s]) => free("g", r.week, wd, s, g) && free("t", r.week, wd, s, r.teacher)
      && dayLoad(g, r.week, wd) < 4 && roomFor(r.week, wd, s, r.room));
    if (!spot) throw new Error(`no place for ${g} ${r.course}`);
    const [wd, s] = spot;
    const room = roomFor(r.week, wd, s, r.room);
    take("g", r.week, wd, s, g); take("t", r.week, wd, s, r.teacher); take("r", r.week, wd, s, room); addLoad(g, r.week, wd);
    placed.push({ group: g, label: `Семинар ${g}`, kind: "seminar", lang_no: null, course: r.course, week: r.week, wd, slot: s, room, teacher: r.teacher });
  }
  // English: four language groups at once
  for (const r of GRID01.filter((x) => x.course === ENGLISH)) {
    const ts = LANG_TEACHERS[g];
    const spot = candidates(r, off).find(([wd, s]) => free("g", r.week, wd, s, g) && dayLoad(g, r.week, wd) < 4
      && ts.every((t) => free("t", r.week, wd, s, t)) && ROOMS.filter((rm) => free("r", r.week, wd, s, rm)).length >= 4);
    if (!spot) throw new Error(`no English place for ${g}`);
    const [wd, s] = spot;
    take("g", r.week, wd, s, g); addLoad(g, r.week, wd);
    ts.forEach((t, i) => {
      const room = roomFor(r.week, wd, s, null);
      take("t", r.week, wd, s, t); take("r", r.week, wd, s, room);
      placed.push({ group: g, label: `Языковая группа ${g}/${i + 1}`, kind: "language", lang_no: i + 1, course: ENGLISH, week: r.week, wd, slot: s, room, teacher: t });
    });
  }
}

// ---------- students ----------
const FEMALE = ["Анна", "Мария", "Дарья", "Полина", "Елизавета", "Софья", "Виктория", "Ксения", "Алиса", "Вероника", "Ульяна", "Арина",
  "Варвара", "Милана", "Ева", "Таисия", "Злата", "Кира", "Яна", "Олеся", "Василиса", "Нина", "Лидия", "Маргарита"];
const MALE = ["Артём", "Максим", "Иван", "Матвей", "Тимофей", "Глеб", "Даниил", "Кирилл", "Никита", "Арсений", "Лев", "Марк",
  "Фёдор", "Савелий", "Мирон", "Ярослав", "Роман", "Илья", "Степан", "Платон", "Захар", "Тихон", "Всеволод", "Елисей"];
const SURNAMES = [["Белоусов", "Белоусова"], ["Гусев", "Гусева"], ["Дроздов", "Дроздова"], ["Ефимов", "Ефимова"], ["Жуков", "Жукова"],
  ["Зуев", "Зуева"], ["Игнатьев", "Игнатьева"], ["Калинин", "Калинина"], ["Комаров", "Комарова"], ["Крылов", "Крылова"],
  ["Лапин", "Лапина"], ["Макаров", "Макарова"], ["Мельников", "Мельникова"], ["Носков", "Носкова"], ["Озеров", "Озерова"],
  ["Панкратов", "Панкратова"], ["Рябов", "Рябова"], ["Савин", "Савина"], ["Тарасов", "Тарасова"], ["Устинов", "Устинова"],
  ["Фомин", "Фомина"], ["Хохлов", "Хохлова"], ["Цветков", "Цветкова"], ["Чернов", "Чернова"], ["Шилов", "Шилова"],
  ["Щукин", "Щукина"], ["Юдин", "Юдина"], ["Ярцев", "Ярцева"], ["Абрамов", "Абрамова"], ["Блинов", "Блинова"],
  ["Вишняков", "Вишнякова"], ["Голубев", "Голубева"], ["Денисов", "Денисова"], ["Ершов", "Ершова"], ["Журавлёв", "Журавлёва"],
  ["Карпов", "Карпова"], ["Лукин", "Лукина"], ["Миронов", "Миронова"], ["Никитин", "Никитина"], ["Орехов", "Орехова"],
  ["Пестов", "Пестова"], ["Родионов", "Родионова"], ["Субботин", "Субботина"], ["Титов", "Титова"], ["Уваров", "Уварова"],
  ["Филатов", "Филатова"], ["Харитонов", "Харитонова"], ["Шубин", "Шубина"], ["Яковлев", "Яковлева"], ["Гордеев", "Гордеева"]]
  .filter(([m]) => !["Миронов", "Ершов"].includes(m)); // not the demo student's or a teacher's surname
const used = new Set(["Александра Миронова", "Егор Лаптев"]);
const students = [];
for (const [gi, g] of GROUPS.entries()) {
  for (let n = 1; n <= 30; n++) {
    const login = `st${String(gi + 1).padStart(2, "0")}.${String(n).padStart(2, "0")}`;
    if (gi === 0 && n === 1) { students.push({ login: "student.demo", group: g, name: "Александра Миронова", female: true, demo: true }); continue; }
    if (gi === 0 && n === 2) { students.push({ login: "student.demo2", group: g, name: "Егор Лаптев", female: false, demo: true }); continue; }
    let name, female;
    do { female = rnd() < 0.55; const s = pick(SURNAMES); name = `${pick(female ? FEMALE : MALE)} ${female ? s[1] : s[0]}`; } while (used.has(name));
    used.add(name);
    students.push({ login, group: g, name, female });
  }
}
const no = (s) => Number(s.login.slice(-2));
const byGroup = (g) => students.filter((s) => s.group === g);
// language groups: 8 / 8 / 7 / 7 (demo students in 3МЭО-01/1)
for (const g of GROUPS) byGroup(g).forEach((s, i) => { s.lang = i < 8 ? 1 : i < 16 ? 2 : i < 23 ? 3 : 4; });
// elective «Мировой финансовый рынок»: the two demo students and 6 others per group
for (const s of students) s.elective = s.demo || [3, 4, 5, 6, 7, 8].includes(no(s)) && s.group === GROUPS[0]
  || [2, 4, 6, 8, 10, 12].includes(no(s)) && s.group !== GROUPS[0];
// academic risk: debts (low marks) and absences
const RISK_MARKS = new Set(["st01.11", "st01.19", "st02.05", "st02.17", "st02.24", "st03.08", "st03.21"]);
const RISK_ABSENT = new Set(["st01.23", "st02.09", "st02.17", "st03.14", "st03.27"]);
for (const s of students) {
  s.ability = s.demo ? 0 : RISK_MARKS.has(s.login) ? 53 + Math.floor(rnd() * 6) : 58 + Math.floor(rnd() * 34);
  s.absence = RISK_ABSENT.has(s.login) ? 26 : RISK_MARKS.has(s.login) ? 12 : 3;
}

// ---------- grades: two assessments per graded course, in the section where the course is taught ----------
const GRADED = [
  [ENGLISH, "language", [["Тест 1", "2026-10-15"], ["Тест 2", "2026-11-12"]]],
  ["Испанский второй", "seminar", [["Диктант", "2026-10-17"], ["Устный ответ", "2026-11-14"]]],
  ["Теория международной экономики", "seminar", [["Контрольная 1", "2026-10-21"], ["Эссе", "2026-11-11"]]],
  ["Международная экономическая интеграция", "lecture", [["Тест по лекциям", "2026-10-14"], ["Семинарская работа", "2026-11-11"]]],
  ["Финансы", "seminar", [["Контрольная 1", "2026-10-22"], ["Контрольная 2", "2026-11-19"]]],
  ["Налоги и налогообложение", "seminar", [["Тест 1", "2026-10-16"], ["Тест 2", "2026-11-13"]]],
  ["Учет во внешнеэкономической деятельности и отчетность", "seminar", [["Практикум", "2026-10-15"], ["Доклад", "2026-11-12"]]],
];
const clamp = (x) => Math.max(18, Math.min(100, Math.round(x)));
const marks = []; // [login, course, title, score, latest]
for (const s of students) {
  if (s.demo) continue; // demo students: marks are derived from their existing attempt in SQL
  for (const [course, , items] of GRADED) {
    const off = (course.length % 7) - 3;
    let a = clamp(s.ability + off + (rnd() - 0.5) * 16);
    let b = clamp(s.ability + off + (rnd() - 0.5) * 18);
    if (RISK_MARKS.has(s.login) && (course === "Финансы" || course.startsWith("Учет"))) b = Math.min(b, 44 - Math.floor(rnd() * 6));
    else if (b < 52) b = 52 + Math.floor(rnd() * 8);
    marks.push([s.login, course, items[0][0], a, false], [s.login, course, items[1][0], b, true]);
  }
}

// ---------- output ----------
const out = [];
const w = (s) => out.push(s);
w(`-- GENERATED by scripts/gen-staff-seed.mjs - do not edit by hand. All people and data are fictional.
-- The поток «3 курс МЭО» of three groups (3МЭО-01..03, 30 students each), 12 language groups, the timetable of
-- 3МЭО-02/03 (placed by the generator without teacher, room or group clashes), grades, absences, requests.
-- 3МЭО-01's demo students (student.demo, student.demo2) keep all their data from 101.

-- 1. Поток and sections of 3МЭО-01 -------------------------------------------------------------------
INSERT INTO stream (programme_id, name, course_year)
SELECT programme.id, '3 курс МЭО', 3 FROM programme JOIN faculty ON faculty.id = programme.faculty_id
WHERE faculty.name = 'Международных экономических отношений' AND programme.name = 'Экономика'
ON CONFLICT (programme_id, name) DO NOTHING;

INSERT INTO acad_group (programme_id, name)
SELECT programme.id, g.name FROM programme JOIN faculty ON faculty.id = programme.faculty_id
CROSS JOIN (VALUES ('3МЭО-02'), ('3МЭО-03')) AS g(name)
WHERE faculty.name = 'Международных экономических отношений' AND programme.name = 'Экономика'
ON CONFLICT (programme_id, name) DO NOTHING;

UPDATE acad_group SET stream_id = (SELECT id FROM stream WHERE name = '3 курс МЭО')
WHERE name IN ('3МЭО-01', '3МЭО-02', '3МЭО-03');

CREATE TEMP VIEW s_course AS
SELECT course.* FROM course JOIN faculty ON faculty.id = course.faculty_id WHERE faculty.name = 'Международных экономических отношений';
CREATE TEMP VIEW s_group AS SELECT * FROM acad_group WHERE name LIKE '3МЭО-0_';

UPDATE section SET kind = 'lecture', stream_id = (SELECT id FROM stream WHERE name = '3 курс МЭО')
WHERE label = 'Лекция' AND course_id IN (SELECT id FROM s_course);
UPDATE section SET kind = 'elective', stream_id = (SELECT id FROM stream WHERE name = '3 курс МЭО')
WHERE label = 'По выбору' AND course_id IN (SELECT id FROM s_course);
UPDATE section SET kind = 'seminar', group_id = (SELECT id FROM s_group WHERE name = '3МЭО-01')
WHERE label = 'Семинар' AND course_id IN (SELECT id FROM s_course WHERE name <> '${ENGLISH}');
UPDATE section SET kind = 'language', lang_no = 1, label = 'Языковая группа 3МЭО-01/1',
    group_id = (SELECT id FROM s_group WHERE name = '3МЭО-01')
WHERE label = 'Семинар' AND course_id IN (SELECT id FROM s_course WHERE name = '${ENGLISH}');

-- 2. Rooms and teachers ---------------------------------------------------------------------------------
INSERT INTO room (name) VALUES ${[...ROOMS, "зал 2"].map((r) => `(${q(r)})`).join(", ")} ON CONFLICT (name) DO NOTHING;
INSERT INTO teacher (name, work_email)
SELECT t.name, t.email FROM (VALUES ${NEW_TEACHERS.map(([n, e]) => `(${q(n)}, ${q(e)})`).join(", ")}) AS t(name, email)
WHERE NOT EXISTS (SELECT 1 FROM teacher WHERE teacher.name = t.name);

-- 3. Students ---------------------------------------------------------------------------------------------
CREATE TEMP TABLE s_student (login text, grp text, name text, female boolean, lang int, elective boolean, absence int, demo boolean) ON COMMIT DROP;
INSERT INTO s_student VALUES
${students.map((s) => `  (${q(s.login)}, ${q(s.group)}, ${q(s.name)}, ${s.female}, ${s.lang}, ${s.elective}, ${s.absence}, ${!!s.demo})`).join(",\n")};

INSERT INTO app_user (login, password_hash) SELECT login, '!disabled' FROM s_student WHERE NOT demo ON CONFLICT (login) DO NOTHING;
INSERT INTO student (id, group_id, name)
SELECT app_user.id, s_group.id, s.name FROM s_student s JOIN app_user ON app_user.login = s.login JOIN s_group ON s_group.name = s.grp
WHERE NOT s.demo ON CONFLICT (id) DO NOTHING;
INSERT INTO student_profile (student_id, record_book, study_level, profile_name, study_form, admission_year, course_year,
    study_status, email, gender, birth_date, phone, address)
SELECT app_user.id, 'ДЕМО-24' || lpad((row_number() OVER (ORDER BY s.login) + 100)::text, 3, '0'), 'Бакалавр',
    'Международные экономические отношения', 'Очная', 2024, 3, 'Обучается', replace(s.login, '.', '') || '@example.org',
    CASE WHEN s.female THEN 'Женский' ELSE 'Мужской' END,
    ('2005-09-01'::date + (abs(hashtext(s.login)) % 540)), NULL, NULL
FROM s_student s JOIN app_user ON app_user.login = s.login WHERE NOT s.demo
ON CONFLICT (student_id) DO NOTHING;

-- 4. Sections of 3МЭО-02/03 and the language groups -----------------------------------------------------
CREATE TEMP TABLE s_grid (grp text, label text, kind text, lang_no int, course text, week int, wd int, slot int, room text, teacher text) ON COMMIT DROP;
INSERT INTO s_grid VALUES
${placed.map((p) => `  (${q(p.group)}, ${q(p.label)}, ${q(p.kind)}, ${p.lang_no ?? "NULL"}, ${q(p.course)}, ${p.week}, ${p.wd}, ${p.slot}, ${q(p.room)}, ${q(p.teacher)})`).join(",\n")};

INSERT INTO section (course_id, label, kind, group_id, lang_no)
SELECT DISTINCT s_course.id, g.label, g.kind, s_group.id, g.lang_no FROM s_grid g
JOIN s_course ON s_course.name = g.course JOIN s_group ON s_group.name = g.grp
ON CONFLICT (course_id, label) DO NOTHING;

-- enrolment: every course of the faculty except the elective, which only its members take
INSERT INTO enrolment (student_id, course_id)
SELECT app_user.id, s_course.id FROM s_student s JOIN app_user ON app_user.login = s.login CROSS JOIN s_course
WHERE NOT s.demo AND (s_course.name <> 'Мировой финансовый рынок' OR s.elective)
ON CONFLICT DO NOTHING;

-- membership: lectures and the elective (поток), the group's seminars, the student's language group
INSERT INTO section_member (section_id, student_id, course_id)
SELECT section.id, app_user.id, section.course_id
FROM s_student s JOIN app_user ON app_user.login = s.login JOIN s_group ON s_group.name = s.grp
JOIN section ON section.course_id IN (SELECT id FROM s_course)
JOIN enrolment ON enrolment.student_id = app_user.id AND enrolment.course_id = section.course_id
WHERE section.kind IN ('lecture', 'elective')
   OR (section.kind = 'seminar' AND section.group_id = s_group.id)
   OR (section.kind = 'language' AND section.group_id = s_group.id AND section.lang_no = s.lang)
ON CONFLICT DO NOTHING;

-- the demo students sat in the old 01 English section, now language group 3МЭО-01/1: nothing to move

INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot)
SELECT section.id, room.id, teacher.id,
    tstzrange((day::date::text || ' ' || sl.starts || '+03')::timestamptz, (day::date::text || ' ' || sl.ends || '+03')::timestamptz, '[)')
FROM generate_series('2026-11-09'::date, '2026-12-27'::date, interval '1 day') AS day
CROSS JOIN LATERAL (SELECT ((day::date - '2026-11-16'::date) % 14 + 14) % 14 AS cycle) AS c
JOIN s_grid g ON g.wd = c.cycle % 7 AND (g.week = 0 OR g.week = CASE WHEN c.cycle < 7 THEN 1 ELSE 2 END)
JOIN (VALUES (0,'09:00','10:20'), (1,'10:35','11:55'), (2,'12:55','14:15'), (3,'14:30','15:50'), (4,'16:00','17:20'), (5,'17:30','18:50'))
    AS sl(slot, starts, ends) ON sl.slot = g.slot
JOIN s_course ON s_course.name = g.course
JOIN section ON section.course_id = s_course.id AND section.label = g.label
JOIN room ON room.name = g.room
JOIN teacher ON teacher.name = g.teacher
WHERE CASE WHEN g.grp = '3МЭО-01' THEN day::date NOT IN ('2026-12-22', '2026-12-25')
           ELSE day::date NOT BETWEEN '2026-12-22' AND '2026-12-25' END;

-- exams: Финансы and the integration exam are taken by the whole поток (moved onto the lecture section);
-- the seminar-only exams get their own dates for 3МЭО-02/03
UPDATE class_occurrence occ SET section_id = lec.id
FROM section sem JOIN s_course ON s_course.id = sem.course_id
JOIN section lec ON lec.course_id = sem.course_id AND lec.kind = 'lecture'
WHERE occ.section_id = sem.id AND occ.is_exam AND sem.kind = 'seminar'
  AND s_course.name IN ('Финансы', 'Международная экономическая интеграция');

INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot, is_exam)
SELECT section.id, room.id, teacher.id, tstzrange(e.starts::timestamptz, e.ends::timestamptz, '[)'), true
FROM (VALUES
    ('Теория международной экономики', 'Семинар 3МЭО-02', 'зал 2', 'Громов И.В.', '2026-12-23 14:30+03', '2026-12-23 17:20+03'),
    ('Теория международной экономики', 'Семинар 3МЭО-03', 'зал 2', 'Громов И.В.', '2026-12-24 14:30+03', '2026-12-24 17:20+03'),
    ('Налоги и налогообложение', 'Семинар 3МЭО-02', '3049', 'Кравец К.А.', '2026-12-29 10:00+03', '2026-12-29 12:00+03'),
    ('Налоги и налогообложение', 'Семинар 3МЭО-03', '3049', 'Кравец К.А.', '2026-12-30 10:00+03', '2026-12-30 12:00+03')
) AS e(course, label, room, teacher, starts, ends)
JOIN s_course ON s_course.name = e.course JOIN section ON section.course_id = s_course.id AND section.label = e.label
JOIN room ON room.name = e.room JOIN teacher ON teacher.name = e.teacher;

-- 5. Journal: assessments and marks -------------------------------------------------------------------------
CREATE TEMP TABLE s_assess (course text, skind text, title text, held_on date, pos int) ON COMMIT DROP;
INSERT INTO s_assess VALUES
${GRADED.flatMap(([c, k, items]) => items.map(([t, d], i) => `  (${q(c)}, ${q(k)}, ${q(t)}, ${q(d)}, ${i + 1})`)).join(",\n")};

INSERT INTO assessment (section_id, title, held_on, position)
SELECT section.id, a.title, a.held_on, a.pos FROM s_assess a
JOIN s_course ON s_course.name = a.course JOIN section ON section.course_id = s_course.id AND section.kind = a.skind;

CREATE TEMP TABLE s_mark (login text, course text, title text, score int, latest boolean) ON COMMIT DROP;
INSERT INTO s_mark VALUES
${marks.map(([l, c, t, s, last]) => `  (${q(l)}, ${q(c)}, ${q(t)}, ${s}, ${last})`).join(",\n")};

-- the latest mark is the course grade the student sees (attempt 1, like 101)
INSERT INTO grade_attempt (student_id, course_id, attempt_no, score, assessed_on, note)
SELECT app_user.id, s_course.id, 1, m.score, a.held_on, m.title
FROM s_mark m JOIN app_user ON app_user.login = m.login JOIN s_course ON s_course.name = m.course
JOIN s_assess a ON a.course = m.course AND a.title = m.title
WHERE m.latest ON CONFLICT DO NOTHING;

INSERT INTO assessment_mark (assessment_id, student_id, score, attempt_no, recorded_at)
SELECT assessment.id, app_user.id, m.score, CASE WHEN m.latest THEN 1 END, (assessment.held_on + interval '18 hours')
FROM s_mark m JOIN app_user ON app_user.login = m.login JOIN s_course ON s_course.name = m.course
JOIN section_member sm ON sm.student_id = app_user.id AND sm.course_id = s_course.id
JOIN assessment ON assessment.section_id = sm.section_id AND assessment.title = m.title
ON CONFLICT DO NOTHING;

-- demo students: the latest assessment repeats their existing grade, the earlier one is close to it
INSERT INTO assessment_mark (assessment_id, student_id, score, attempt_no, recorded_at)
SELECT assessment.id, ga.student_id,
    CASE WHEN assessment.position = 2 THEN ga.score ELSE greatest(20, least(100, ga.score + (abs(hashtext(app_user.login || assessment.title)) % 13) - 6)) END,
    CASE WHEN assessment.position = 2 THEN 1 END, (assessment.held_on + interval '18 hours')
FROM s_student s JOIN app_user ON app_user.login = s.login
JOIN grade_attempt ga ON ga.student_id = app_user.id AND ga.attempt_no = 1
JOIN section_member sm ON sm.student_id = ga.student_id AND sm.course_id = ga.course_id
JOIN assessment ON assessment.section_id = sm.section_id
WHERE s.demo ON CONFLICT DO NOTHING;

-- 6. Attendance of the past classes (before 2026-11-21), deterministic --------------------------------------
INSERT INTO attendance (occurrence_id, student_id, status, excused, excuse_note, marked_at)
SELECT occ.id, member.student_id,
    CASE WHEN h.v < s.absence THEN 'absent' WHEN h.v < s.absence + 3 THEN 'late' ELSE 'present' END,
    h.v < s.absence AND h.v % 4 = 0,
    CASE WHEN h.v < s.absence AND h.v % 4 = 0 THEN 'Справка из поликлиники' END,
    upper(occ.slot)
FROM class_occurrence occ JOIN section ON section.id = occ.section_id
JOIN s_course ON s_course.id = section.course_id
JOIN section_member member ON member.section_id = section.id
JOIN app_user ON app_user.id = member.student_id JOIN s_student s ON s.login = app_user.login
CROSS JOIN LATERAL (SELECT abs(hashtext(app_user.login || to_char(lower(occ.slot), 'YYYYMMDDHH24MI') || s_course.name)) % 100 AS v) AS h
WHERE occ.status <> 'cancelled' AND NOT occ.is_exam AND lower(occ.slot) < '2026-11-21 00:00+03'
ON CONFLICT DO NOTHING;
`);

w(`
-- 7. Requests across the поток (open, overdue, ready, closed: for the queue and the stats) -----------------
CREATE TEMP TABLE s_req (login text, kind text, status text, message text, created timestamptz, steps text[], hours int[]) ON COMMIT DROP;
INSERT INTO s_req VALUES
  ('st01.05', 'certificate', 'submitted', E'Куда: По месту требования\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-14 10:20+03', '{}', '{}'),
  ('st02.11', 'gradebook_extract', 'submitted', E'Куда: В другой вуз\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-16 12:05+03', '{}', '{}'),
  ('st03.04', 'certificate', 'submitted', E'Куда: В банк\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-20 17:40+03', '{}', '{}'),
  ('st02.20', 'military_certificate', 'submitted', E'Куда: В военкомат\\nЭкземпляров: 2\\nЯзык: Русский', '2026-11-21 08:15+03', '{}', '{}'),
  ('st03.16', 'certificate', 'submitted', E'Куда: В посольство\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-19 09:30+03', '{}', '{}'),
  ('st01.14', 'stipend_amount', 'in_review', E'Куда: В соцзащиту\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-13 11:00+03', '{in_review}', '{20}'),
  ('st02.03', 'group_transfer', 'in_review', E'Комментарий: Прошу перевести в группу 3МЭО-03 из-за расписания тренировок', '2026-11-18 14:10+03', '{in_review}', '{4}'),
  ('st03.25', 'certificate_english', 'needs_info', E'Куда: В посольство\\nЭкземпляров: 1\\nЯзык: Английский', '2026-11-17 16:00+03', '{in_review,needs_info}', '{3,26}'),
  ('st01.09', 'certificate', 'ready', E'Куда: По месту требования\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-17 10:00+03', '{in_review,ready}', '{2,30}'),
  ('st02.14', 'military_certificate', 'ready', E'Куда: В военкомат\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-18 09:00+03', '{in_review,ready}', '{5,28}'),
  ('st03.02', 'stipend_amount', 'ready', E'Куда: В банк\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-19 13:00+03', '{in_review,ready}', '{3,22}'),
  ('st02.28', 'certificate', 'ready', E'Куда: В налоговую\\nЭкземпляров: 2\\nЯзык: Русский', '2026-11-16 15:30+03', '{in_review,ready}', '{1,44}'),
  ('st01.21', 'certificate', 'issued', E'Куда: По месту требования\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-09 10:00+03', '{in_review,ready,issued}', '{2,26,70}'),
  ('st02.07', 'gradebook_extract', 'issued', E'Куда: В другой вуз\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-10 12:00+03', '{in_review,ready,issued}', '{6,50,96}'),
  ('st03.11', 'certificate', 'issued', E'Куда: В банк\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-11 09:40+03', '{in_review,ready,issued}', '{1,20,48}'),
  ('st03.19', 'stipend_amount', 'issued', E'Куда: В соцзащиту\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-12 11:20+03', '{in_review,ready,issued}', '{4,40,72}'),
  ('st01.27', 'certificate_english', 'rejected', E'Куда: В посольство\\nЭкземпляров: 1\\nЯзык: Английский', '2026-11-12 15:00+03', '{in_review,rejected}', '{3,30}'),
  ('st02.22', 'certificate', 'issued', E'Куда: По месту требования\\nЭкземпляров: 1\\nЯзык: Русский', '2026-11-13 10:10+03', '{in_review,ready,issued}', '{2,18,52}');

CREATE TEMP TABLE s_req_ids ON COMMIT DROP AS
WITH ins AS (
    INSERT INTO request (student_id, idempotency_key, kind, status, message, version, created_at)
    SELECT app_user.id, gen_random_uuid(), r.kind, r.status, r.message, cardinality(r.steps), r.created
    FROM s_req r JOIN app_user ON app_user.login = r.login
    RETURNING id, student_id, kind
)
SELECT ins.id, ins.student_id, r.* FROM ins JOIN app_user ON app_user.id = ins.student_id JOIN s_req r ON r.login = app_user.login AND r.kind = ins.kind;

INSERT INTO request_event (request_id, version, actor_id, status, message, created_at)
SELECT id, 0, student_id, 'submitted', message, created FROM s_req_ids
UNION ALL
SELECT ids.id, step.n::int, (SELECT id FROM app_user WHERE login = 'dean.demo'), step.status,
    CASE step.status WHEN 'in_review' THEN 'Взяли в работу.' WHEN 'needs_info' THEN 'Уточните, нужен ли перевод с нотариальным заверением.'
      WHEN 'ready' THEN 'Можно забрать в деканате, каб. 210.' WHEN 'issued' THEN 'Выдано.' ELSE 'Для посольства нужна справка на английском с апостилем, подайте заявку в отдел документов.' END,
    ids.created + ids.hours[step.n::int] * interval '1 hour'
FROM s_req_ids ids CROSS JOIN LATERAL unnest(ids.steps) WITH ORDINALITY AS step(status, n);

-- 8. Questions to the deanery -----------------------------------------------------------------------------
INSERT INTO deanery_question (student_id, idempotency_key, topic, body, created_at, answer, answered_by, answered_at)
SELECT app_user.id, gen_random_uuid(), d.topic, d.body, d.asked::timestamptz, d.answer,
    CASE WHEN d.answer IS NOT NULL THEN (SELECT id FROM app_user WHERE login = 'dean.demo') END, d.answered::timestamptz
FROM (VALUES
    ('st02.06', 'timetable', 'В субботу у 3МЭО-02 английский и испанский стоят подряд в разных корпусах. Можно ли поменять аудиторию?', '2026-11-18 19:20+03', NULL, NULL),
    ('st03.12', 'stipend', 'Почему мне не начислили повышенную стипендию за октябрь?', '2026-11-19 10:05+03', NULL, NULL),
    ('st01.17', 'documents', 'Сколько делается справка в военкомат?', '2026-11-20 12:40+03', NULL, NULL),
    ('st02.25', 'other', 'Можно ли перейти в другую языковую группу английского?', '2026-11-21 09:10+03', NULL, NULL),
    ('st03.29', 'timetable', 'Когда пересдача по налогам?', '2026-11-17 15:00+03', NULL, NULL),
    ('st01.06', 'documents', 'Можно ли получить выписку из зачётной книжки на английском?', '2026-11-12 11:00+03',
     'Да, выберите в заявках «Выписка из электронной зачетной книжки на английском языке».', '2026-11-12 15:30+03'),
    ('st02.13', 'stipend', 'Когда придёт стипендия?', '2026-11-14 10:00+03', 'Стипендия за ноябрь придёт 25 ноября.', '2026-11-14 12:10+03')
) AS d(login, topic, body, asked, answer, answered) JOIN app_user ON app_user.login = d.login;

-- 9. Resits: one waiting for teacher.demo's result, one ahead --------------------------------------------
INSERT INTO resit (student_id, course_id, scheduled_at, room, examiner_id, status, created_by, created_at)
SELECT app_user.id, s_course.id, r.at::timestamptz, r.room, teacher.id, 'scheduled', (SELECT id FROM app_user WHERE login = 'dean.demo'), '2026-11-17 12:00+03'
FROM (VALUES ('st02.05', 'Финансы', '2026-11-20 16:00+03', '4010', 'Белова О.Н.'),
             ('st02.17', 'Учет во внешнеэкономической деятельности и отчетность', '2026-11-27 16:00+03', '2011', 'Кузнецова Т.Р.'))
    AS r(login, course, at, room, teacher)
JOIN app_user ON app_user.login = r.login JOIN s_course ON s_course.name = r.course JOIN teacher ON teacher.name = r.teacher;

-- 10. A teacher's request to the deanery, an assignment, a group message, targeted news -------------------
INSERT INTO teacher_request (author_id, occurrence_id, kind, body, created_at)
SELECT app_user.id, (SELECT occ.id FROM class_occurrence occ JOIN section ON section.id = occ.section_id
    WHERE section.label = 'Семинар 3МЭО-03' AND section.course_id = (SELECT id FROM s_course WHERE name = 'Финансы')
      AND lower(occ.slot) > '2026-11-24' ORDER BY lower(occ.slot) LIMIT 1),
    'room', 'Нужна аудитория с проектором: студенты защищают кейсы.', '2026-11-20 18:30+03'
FROM app_user WHERE login = 'teacher.demo';

WITH a AS (
    INSERT INTO assessment (section_id, title, held_on, position)
    SELECT section.id, 'Кейс 4', '2026-12-04', 3 FROM section
    WHERE section.label = 'Семинар 3МЭО-02' AND section.course_id = (SELECT id FROM s_course WHERE name = 'Финансы')
    RETURNING id, section_id
), asg AS (
    INSERT INTO assignment (section_id, author_id, title, due_on, plagiarism, assessment_id, created_at)
    SELECT a.section_id, app_user.id, 'Кейс 4: бюджет компании', '2026-12-04', true, a.id, '2026-11-19 18:00+03'
    FROM a CROSS JOIN app_user WHERE app_user.login = 'teacher.demo'
    RETURNING id, section_id, title, due_on
)
INSERT INTO plagiarism_work (student_id, title, deadline, assignment_id)
SELECT m.student_id, asg.title, asg.due_on, asg.id FROM asg JOIN section_member m ON m.section_id = asg.section_id;

-- part of 3МЭО-02 has already uploaded the case (simulated scores), so the teacher has works to mark
UPDATE plagiarism_work w SET filename = 'keys-4.docx', uploaded_at = '2026-11-20 21:00+03', attempts = 1,
    originality = 66 + abs(hashtext(app_user.login)) % 28,
    status = CASE WHEN 66 + abs(hashtext(app_user.login)) % 28 >= 75 THEN 'accepted' ELSE 'below' END
FROM app_user WHERE app_user.id = w.student_id AND w.assignment_id IS NOT NULL
  AND app_user.login IN ('st02.01','st02.02','st02.03','st02.04','st02.06','st02.07','st02.08','st02.10','st02.11','st02.12','st02.13','st02.15','st02.16','st02.18');

INSERT INTO group_message (section_id, author_id, body, created_at)
SELECT section.id, app_user.id, 'На семинаре 24 ноября разбираем кейс 3, принесите расчёты.', '2026-11-19 18:05+03'
FROM section CROSS JOIN app_user
WHERE section.label = 'Семинар 3МЭО-02' AND section.course_id = (SELECT id FROM s_course WHERE name = 'Финансы') AND app_user.login = 'teacher.demo';

WITH news AS (
    INSERT INTO announcement (id, faculty_id, author_id, title, body, published_at)
    SELECT gen_random_uuid(), staff.faculty_id, staff.id, n.title, n.body, n.at::timestamptz
    FROM (VALUES ('3МЭО-02: собрание группы', 'Во вторник после второй пары староста собирает группу в ауд. 2103: выборы в студсовет.', '2026-11-20 13:00+03', 'group', '3МЭО-02'),
                 ('Поток: консультация перед сессией', 'Консультация по финансам для всего потока 15 декабря в зале 4.', '2026-11-20 14:00+03', 'stream', '3 курс МЭО'))
        AS n(title, body, at, scope, target)
    JOIN app_user ON app_user.login = 'dean.demo' JOIN staff ON staff.id = app_user.id
    RETURNING id, title
)
INSERT INTO announcement_target (announcement_id, scope, target_id)
SELECT news.id, CASE WHEN news.title LIKE '3МЭО-02%' THEN 'group' ELSE 'stream' END,
    CASE WHEN news.title LIKE '3МЭО-02%' THEN (SELECT id FROM s_group WHERE name = '3МЭО-02') ELSE (SELECT id FROM stream WHERE name = '3 курс МЭО') END
FROM news;

-- 11. Today's timetable changes (2026-11-21), so «Изменения сегодня» has a story on the demo day --------
CREATE TEMP TABLE s_change ON COMMIT DROP AS
WITH moved AS (
    UPDATE class_occurrence occ SET room_id = (SELECT id FROM room WHERE name = '3210'),
        original_room_id = occ.room_id, original_slot = occ.slot, status = 'moved', version = occ.version + 1
    FROM section WHERE section.id = occ.section_id AND section.label = 'Семинар 3МЭО-03'
      AND occ.slot && tstzrange('2026-11-21 00:00+03', '2026-11-22 00:00+03') AND occ.status = 'scheduled'
      AND occ.id = (SELECT o2.id FROM class_occurrence o2 JOIN section s2 ON s2.id = o2.section_id
          WHERE s2.label = 'Семинар 3МЭО-03' AND o2.slot && tstzrange('2026-11-21 00:00+03', '2026-11-22 00:00+03')
            AND NOT EXISTS (SELECT 1 FROM class_occurrence o3 JOIN room r3 ON r3.id = o3.room_id WHERE r3.name = '3210' AND o3.slot && o2.slot)
          ORDER BY lower(o2.slot) DESC LIMIT 1)
    RETURNING occ.id, occ.section_id, occ.slot, 'moved'::text AS status, (SELECT name FROM room WHERE id = occ.original_room_id) AS before_room,
        '3210'::text AS after_room, 'В аудитории не работает отопление.'::text AS reason, '2026-11-21 08:20+03'::timestamptz AS at
)
SELECT * FROM moved;

INSERT INTO change_event (kind, entity_id, payload, created_at)
SELECT 'class_status', ch.id, jsonb_build_object('status', ch.status, 'course', course.name, 'section', section.label,
    'beforeStart', lower(ch.slot), 'beforeEnd', upper(ch.slot), 'afterStart', lower(ch.slot), 'afterEnd', upper(ch.slot),
    'room', ch.after_room, 'beforeRoom', ch.before_room, 'reason', ch.reason), ch.at
FROM s_change ch JOIN section ON section.id = ch.section_id JOIN course ON course.id = section.course_id;

INSERT INTO notification (change_event_id, student_id)
SELECT event.id, member.student_id FROM change_event event JOIN s_change ch ON ch.id = event.entity_id
JOIN section_member member ON member.section_id = ch.section_id ON CONFLICT DO NOTHING;

DROP VIEW s_course;
DROP VIEW s_group;
`);
process.stdout.write(out.join("\n"));
console.error(`students ${students.length}, placed rows ${placed.length}, marks ${marks.length}`);
