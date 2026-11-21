-- «Цифровой деканат»: demo dataset for group 3МЭО-01. All people are fictional.
-- The subjects, rooms and slots follow the mock-up's grid(); teacher names are fictional.
-- Two-week cycle: Monday 2026-11-16 starts week 1. Times are Moscow (+03).

-- 1. Faculty, programme, group --------------------------------------------------------------
INSERT INTO faculty (name) VALUES ('Международных экономических отношений') ON CONFLICT (name) DO NOTHING;
INSERT INTO programme (faculty_id, name)
SELECT id, 'Экономика' FROM faculty WHERE name = 'Международных экономических отношений'
ON CONFLICT (faculty_id, name) DO NOTHING;
INSERT INTO acad_group (programme_id, name)
SELECT programme.id, '3МЭО-01' FROM programme JOIN faculty ON faculty.id = programme.faculty_id
WHERE faculty.name = 'Международных экономических отношений' AND programme.name = 'Экономика'
ON CONFLICT (programme_id, name) DO NOTHING;

-- 2. Accounts (passwords stay disabled until npm run db:setup enables the demo logins) ------
INSERT INTO app_user (login, password_hash) VALUES
    ('student.demo', '!disabled'), ('student.demo2', '!disabled'),
    ('dean.demo', '!disabled'), ('teacher.demo', '!disabled')
ON CONFLICT (login) DO NOTHING;

INSERT INTO student (id, group_id, name)
SELECT app_user.id, acad_group.id, demo.name
FROM (VALUES ('student.demo', 'Александра Миронова'), ('student.demo2', 'Егор Лаптев')) AS demo(login, name)
JOIN app_user ON app_user.login = demo.login
CROSS JOIN acad_group WHERE acad_group.name = '3МЭО-01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, faculty_id, name)
SELECT app_user.id, faculty.id, 'Вера Лосева'
FROM app_user CROSS JOIN faculty
WHERE app_user.login = 'dean.demo' AND faculty.name = 'Международных экономических отношений'
ON CONFLICT (id) DO NOTHING;

INSERT INTO student_profile (student_id, record_book, study_level, profile_name, study_form,
    admission_year, course_year, study_status, email, gender, birth_date, phone, address)
SELECT app_user.id, demo.book, 'Бакалавр', 'Международные экономические отношения', 'Очная',
    2024, 3, 'Обучается', demo.email, demo.gender, demo.born::date, NULL, NULL
FROM (VALUES
    ('student.demo', 'ДЕМО-24001', 'student@example.org', 'Женский', '2006-05-14'),
    ('student.demo2', 'ДЕМО-24002', 'student2@example.org', 'Мужской', '2005-11-02')
) AS demo(login, book, email, gender, born)
JOIN app_user ON app_user.login = demo.login
ON CONFLICT (student_id) DO NOTHING;

-- 3. Rooms and teachers ---------------------------------------------------------------------
INSERT INTO room (name) VALUES
    ('2061'), ('зал 4'), ('233'), ('2049'), ('онлайн'), ('3072'), ('4010'), ('2011'),
    ('4051'), ('4049'), ('2075'), ('3049'), ('4046'), ('1051')
ON CONFLICT (name) DO NOTHING;

INSERT INTO teacher (name, work_email)
SELECT demo.name, demo.email FROM (VALUES
    ('Соколова Е.А.', 'sokolova@example.org'), ('Громов И.В.', 'gromov@example.org'),
    ('Белова О.Н.', 'belova@example.org'), ('Ортега Л.П.', 'ortega@example.org'),
    ('Ершов А.М.', 'ershov@example.org'), ('Кравец К.А.', 'kravets@example.org'),
    ('Миронец Т.И.', 'mironets@example.org'), ('Зотова З.А.', 'zotova@example.org'),
    ('Кузнецова Т.Р.', 'kuznetsova@example.org'), ('Ветров А.Ю.', 'vetrov@example.org'),
    ('Военный учебный центр', NULL)
) AS demo(name, email)
WHERE NOT EXISTS (SELECT 1 FROM teacher WHERE teacher.name = demo.name);

INSERT INTO teacher_account (user_id, teacher_id)
SELECT app_user.id, teacher.id FROM app_user CROSS JOIN teacher
WHERE app_user.login = 'teacher.demo' AND teacher.name = 'Белова О.Н.'
ON CONFLICT DO NOTHING;

-- 4. The two-week grid (wd: 0 = Monday; week 0 = both weeks) --------------------------------
CREATE TEMP TABLE cifry_grid (week int, wd int, slot int, course text, kind text, room text, teacher text) ON COMMIT DROP;
INSERT INTO cifry_grid VALUES
    (0,1,0,'Английский первый','Семинар','2061','Соколова Е.А.'),
    (1,1,1,'Теория международных экономических отношений','Лекция','зал 4','Громов И.В.'),
    (2,1,1,'Финансы','Лекция','зал 4','Белова О.Н.'),
    (0,1,2,'Испанский второй','Семинар','233','Ортега Л.П.'),
    (1,1,3,'Экономика Европейского Союза и Великобритании','Семинар','зал 4','Ершов А.М.'),
    (2,1,3,'Экономика стран Латинской Америки','Семинар','2049','Ершов А.М.'),
    (0,1,4,'Военный перевод','Семинар','онлайн','Военный учебный центр'),
    (0,2,1,'Мировой финансовый рынок','По выбору','3072','Кравец К.А.'),
    (1,2,2,'Международная экономическая интеграция','Лекция','зал 4','Миронец Т.И.'),
    (2,2,2,'Экономическая политика России','Лекция','зал 4','Зотова З.А.'),
    (1,2,3,'Теория международной экономики','Семинар','4010','Громов И.В.'),
    (2,2,3,'Финансы','Семинар','4010','Белова О.Н.'),
    (0,3,0,'Учет во внешнеэкономической деятельности и отчетность','Семинар','2011','Кузнецова Т.Р.'),
    (0,3,1,'Испанский второй','Семинар','4051','Ортега Л.П.'),
    (0,3,2,'Английский первый','Семинар','4049','Соколова Е.А.'),
    (0,3,3,'Военный перевод','Семинар','онлайн','Военный учебный центр'),
    (1,4,1,'Международные экономические отношения','Семинар','2075','Миронец Т.И.'),
    (2,4,1,'Экономическая политика России','Семинар','2075','Зотова З.А.'),
    (0,4,2,'Налоги и налогообложение','Семинар','3049','Кравец К.А.'),
    (0,4,3,'Английский первый','Семинар','4046','Ветров А.Ю.'),
    (1,4,5,'Военный перевод','Семинар','онлайн','Военный учебный центр'),
    (0,5,0,'Военный перевод','Семинар','онлайн','Военный учебный центр'),
    (0,5,1,'Испанский второй','Семинар','233','Ортега Л.П.'),
    (0,5,2,'Английский первый','Семинар','1051','Ветров А.Ю.');

CREATE TEMP TABLE cifry_slot (slot int, starts text, ends text) ON COMMIT DROP;
INSERT INTO cifry_slot VALUES
    (0,'09:00','10:20'), (1,'10:35','11:55'), (2,'12:55','14:15'),
    (3,'14:30','15:50'), (4,'16:00','17:20'), (5,'17:30','18:50');

-- 5. Courses, sections, enrolment -----------------------------------------------------------
INSERT INTO course (faculty_id, name, credits, assessment_kind)
SELECT faculty.id, names.course,
    CASE WHEN names.course IN ('Финансы','Теория международной экономики','Международная экономическая интеграция') THEN 5 ELSE 3 END,
    CASE WHEN names.course IN ('Финансы','Теория международной экономики','Международная экономическая интеграция') THEN 'exam' ELSE 'credit' END
FROM (SELECT DISTINCT course FROM cifry_grid) AS names
CROSS JOIN faculty WHERE faculty.name = 'Международных экономических отношений'
AND NOT EXISTS (SELECT 1 FROM course WHERE course.faculty_id = faculty.id AND course.name = names.course);

CREATE TEMP VIEW cifry_course AS
SELECT course.* FROM course JOIN faculty ON faculty.id = course.faculty_id
WHERE faculty.name = 'Международных экономических отношений';

INSERT INTO section (course_id, label)
SELECT DISTINCT cifry_course.id, cifry_grid.kind FROM cifry_grid
JOIN cifry_course ON cifry_course.name = cifry_grid.course
ON CONFLICT (course_id, label) DO NOTHING;

INSERT INTO enrolment (student_id, course_id)
SELECT student.id, cifry_course.id FROM student
JOIN app_user ON app_user.id = student.id AND app_user.login IN ('student.demo', 'student.demo2')
CROSS JOIN cifry_course
ON CONFLICT DO NOTHING;

INSERT INTO section_member (section_id, student_id, course_id)
SELECT section.id, student.id, section.course_id FROM student
JOIN app_user ON app_user.id = student.id AND app_user.login IN ('student.demo', 'student.demo2')
CROSS JOIN section JOIN cifry_course ON cifry_course.id = section.course_id
ON CONFLICT DO NOTHING;

-- 6. Class occurrences 2026-11-09 .. 2026-12-27; no classes on the two exam days ------------
INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot)
SELECT section.id, room.id, teacher.id,
    tstzrange((day::date::text || ' ' || cifry_slot.starts || '+03')::timestamptz,
              (day::date::text || ' ' || cifry_slot.ends || '+03')::timestamptz, '[)')
FROM generate_series('2026-11-09'::date, '2026-12-27'::date, interval '1 day') AS day
CROSS JOIN LATERAL (SELECT ((day::date - '2026-11-16'::date) % 14 + 14) % 14 AS cycle) AS c
JOIN cifry_grid ON cifry_grid.wd = c.cycle % 7
    AND (cifry_grid.week = 0 OR cifry_grid.week = CASE WHEN c.cycle < 7 THEN 1 ELSE 2 END)
JOIN cifry_slot ON cifry_slot.slot = cifry_grid.slot
JOIN cifry_course ON cifry_course.name = cifry_grid.course
JOIN section ON section.course_id = cifry_course.id AND section.label = cifry_grid.kind
JOIN room ON room.name = cifry_grid.room
JOIN teacher ON teacher.name = cifry_grid.teacher
WHERE day::date NOT IN ('2026-12-22', '2026-12-25');

-- Exams and the credit (зачёт) of the session
INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot, is_exam)
SELECT (SELECT section.id FROM section WHERE section.course_id = cifry_course.id ORDER BY section.label DESC LIMIT 1),
    room.id, teacher.id, tstzrange(demo.starts::timestamptz, demo.ends::timestamptz, '[)'), true
FROM (VALUES
    ('Теория международной экономики', '4010', 'Громов И.В.', '2026-12-22 10:00+03', '2026-12-22 13:00+03'),
    ('Финансы', 'зал 4', 'Белова О.Н.', '2026-12-25 10:00+03', '2026-12-25 13:00+03'),
    ('Налоги и налогообложение', '3049', 'Кравец К.А.', '2026-12-28 10:00+03', '2026-12-28 12:00+03'),
    ('Международная экономическая интеграция', 'зал 4', 'Миронец Т.И.', '2027-01-12 10:00+03', '2027-01-12 13:00+03')
) AS demo(course, room, teacher, starts, ends)
JOIN cifry_course ON cifry_course.name = demo.course
JOIN room ON room.name = demo.room
JOIN teacher ON teacher.name = demo.teacher;

-- 7. Seeded timetable changes on 2026-11-20 (same payload shape as Codex's changeClass) -----
CREATE TEMP TABLE cifry_change ON COMMIT DROP AS
WITH moved AS (
    UPDATE class_occurrence occ SET
        room_id = (SELECT id FROM room WHERE name = '2011'),
        original_room_id = occ.room_id, original_slot = occ.slot, status = 'moved', version = occ.version + 1
    FROM section, cifry_course
    WHERE section.id = occ.section_id AND cifry_course.id = section.course_id
      AND cifry_course.name = 'Налоги и налогообложение'
      AND lower(occ.slot) = '2026-11-20 12:55+03' AND occ.status = 'scheduled'
    RETURNING occ.id, occ.section_id, occ.slot, 'moved'::text AS status, '3049'::text AS before_room, '2011'::text AS after_room,
        'В ауд. 3049 сломан проектор.'::text AS reason, '2026-11-20 09:12+03'::timestamptz AS at
), cancelled AS (
    UPDATE class_occurrence occ SET status = 'cancelled', version = occ.version + 1
    FROM section, cifry_course
    WHERE section.id = occ.section_id AND cifry_course.id = section.course_id
      AND cifry_course.name = 'Военный перевод'
      AND lower(occ.slot) = '2026-11-20 17:30+03' AND occ.status = 'scheduled'
    RETURNING occ.id, occ.section_id, occ.slot, 'cancelled'::text AS status, 'онлайн'::text AS before_room, 'онлайн'::text AS after_room,
        'Преподаватель в командировке. Новое время пришлём в уведомлениях.'::text AS reason, '2026-11-19 18:40+03'::timestamptz AS at
)
SELECT * FROM moved UNION ALL SELECT * FROM cancelled;

INSERT INTO change_event (kind, entity_id, payload, created_at)
SELECT 'class_status', ch.id, jsonb_build_object('status', ch.status, 'course', course.name, 'section', section.label,
    'beforeStart', lower(ch.slot), 'beforeEnd', upper(ch.slot), 'afterStart', lower(ch.slot), 'afterEnd', upper(ch.slot),
    'room', ch.after_room, 'beforeRoom', ch.before_room, 'reason', ch.reason), ch.at
FROM cifry_change ch JOIN section ON section.id = ch.section_id JOIN course ON course.id = section.course_id;

INSERT INTO notification (change_event_id, student_id, read_at)
SELECT event.id, member.student_id,
    CASE WHEN event.payload->>'status' = 'cancelled' THEN event.created_at + interval '1 hour' END
FROM change_event event JOIN cifry_change ch ON ch.id = event.entity_id
JOIN section_member member ON member.section_id = ch.section_id
ON CONFLICT DO NOTHING;

-- 8. Requests ---------------------------------------------------------------------------------
CREATE TEMP TABLE cifry_request (login text, kind text, status text, message text, created timestamptz,
    steps text[], notes text[], read_last boolean) ON COMMIT DROP;
INSERT INTO cifry_request VALUES
    ('student.demo', 'certificate', 'ready',
     E'Куда: По месту требования\nЭкземпляров: 1\nЯзык: Русский', '2026-11-18 11:20+03',
     ARRAY['in_review','ready'], ARRAY['Справку готовим.','Можно забрать в деканате, каб. 210, до 27 ноября.'], false),
    ('student.demo', 'military_certificate', 'in_review',
     E'Куда: В военкомат\nЭкземпляров: 2\nЯзык: Русский', '2026-11-19 09:40+03',
     ARRAY['in_review'], ARRAY['Деканат готовит справку, обычно 2 рабочих дня.'], true),
    ('student.demo2', 'certificate_english', 'submitted',
     E'Куда: В посольство\nЭкземпляров: 1\nЯзык: Английский\nКомментарий: Нужна печать на каждой странице', '2026-11-20 15:05+03',
     ARRAY[]::text[], ARRAY[]::text[], true),
    ('student.demo2', 'stipend_amount', 'issued',
     E'Куда: В банк\nЭкземпляров: 1\nЯзык: Русский', '2026-11-10 10:00+03',
     ARRAY['in_review','ready','issued'], ARRAY['Справку готовим.','Можно забрать в каб. 210.','Справка выдана.'], true);

CREATE TEMP TABLE cifry_request_ids ON COMMIT DROP AS
WITH inserted AS (
    INSERT INTO request (student_id, idempotency_key, kind, status, message, version, created_at)
    SELECT app_user.id, gen_random_uuid(), r.kind, r.status, r.message, cardinality(r.steps), r.created
    FROM cifry_request r JOIN app_user ON app_user.login = r.login
    RETURNING id, student_id, kind
)
SELECT inserted.id, inserted.student_id, r.* FROM inserted JOIN app_user ON app_user.id = inserted.student_id
JOIN cifry_request r ON r.login = app_user.login AND r.kind = inserted.kind;

INSERT INTO request_event (request_id, version, actor_id, status, message, created_at)
SELECT id, 0, student_id, 'submitted', message, created FROM cifry_request_ids
UNION ALL
SELECT ids.id, step.n::int, (SELECT id FROM app_user WHERE login = 'dean.demo'), step.status, ids.notes[step.n::int],
    ids.created + step.n::int * interval '1 day' + interval '3 hours'
FROM cifry_request_ids ids CROSS JOIN LATERAL unnest(ids.steps) WITH ORDINALITY AS step(status, n);

-- the latest status change of each request reaches the student's inbox
CREATE TEMP TABLE cifry_request_events ON COMMIT DROP AS
WITH last_step AS (
    SELECT ids.id, ids.student_id, ids.read_last, ids.steps[cardinality(ids.steps)] AS after,
        COALESCE(ids.steps[cardinality(ids.steps) - 1], 'submitted') AS before,
        ids.notes[cardinality(ids.notes)] AS reason,
        CASE WHEN ids.kind = 'certificate' THEN '2026-11-20 10:30+03'::timestamptz
             ELSE ids.created + cardinality(ids.steps) * interval '1 day' + interval '3 hours' END AS at
    FROM cifry_request_ids ids WHERE cardinality(ids.steps) > 0
)
SELECT * FROM last_step;

UPDATE request_event SET created_at = e.at FROM cifry_request_events e
WHERE request_event.request_id = e.id AND request_event.status = e.after;

WITH events AS (
    INSERT INTO change_event (kind, entity_id, payload, created_at)
    SELECT 'request_status', e.id, jsonb_build_object('before', e.before, 'after', e.after, 'reason', e.reason), e.at
    FROM cifry_request_events e
    RETURNING id, entity_id
)
INSERT INTO notification (change_event_id, student_id, read_at)
SELECT events.id, e.student_id, CASE WHEN e.read_last THEN e.at + interval '2 hours' END
FROM events JOIN cifry_request_events e ON e.id = events.entity_id;

-- 9. Grades -------------------------------------------------------------------------------------
INSERT INTO grade_attempt (student_id, course_id, attempt_no, score, assessed_on, note)
SELECT app_user.id, cifry_course.id, 1, demo.score, demo.day::date, demo.note
FROM (VALUES
    ('student.demo', 'Английский первый', 92, 'тест 18/20', '2026-11-12'),
    ('student.demo', 'Испанский второй', 88, 'устный ответ: отлично', '2026-11-14'),
    ('student.demo', 'Теория международной экономики', 86, 'эссе: отлично', '2026-11-11'),
    ('student.demo', 'Международная экономическая интеграция', 81, 'семинар 9/10', '2026-11-11'),
    ('student.demo', 'Финансы', 74, 'контрольная 8/10', '2026-11-19'),
    ('student.demo', 'Налоги и налогообложение', 69, 'тест 14/20', '2026-11-13'),
    ('student.demo', 'Учет во внешнеэкономической деятельности и отчетность', 58, 'доклад не сдан', '2026-11-12'),
    ('student.demo2', 'Английский первый', 85, 'тест 17/20', '2026-11-12'),
    ('student.demo2', 'Испанский второй', 79, 'устный ответ: хорошо', '2026-11-14'),
    ('student.demo2', 'Теория международной экономики', 72, 'эссе: хорошо', '2026-11-11'),
    ('student.demo2', 'Международная экономическая интеграция', 90, 'семинар 10/10', '2026-11-11'),
    ('student.demo2', 'Финансы', 66, 'контрольная 6/10', '2026-11-19'),
    ('student.demo2', 'Налоги и налогообложение', 81, 'тест 16/20', '2026-11-13'),
    ('student.demo2', 'Учет во внешнеэкономической деятельности и отчетность', 47, 'зачётная работа не сдана', '2026-11-12')
) AS demo(login, course, score, note, day)
JOIN app_user ON app_user.login = demo.login
JOIN cifry_course ON cifry_course.name = demo.course
ON CONFLICT DO NOTHING;

WITH event AS (
    INSERT INTO change_event (kind, entity_id, payload, created_at)
    SELECT 'grade_changed', id, jsonb_build_object('course', name, 'attempt', 1, 'score', 74, 'corrected', false, 'note', 'контрольная 8/10'),
        '2026-11-19 16:05+03'
    FROM cifry_course WHERE name = 'Финансы'
    RETURNING id
)
INSERT INTO notification (change_event_id, student_id, read_at)
SELECT event.id, app_user.id, '2026-11-19 17:00+03' FROM event CROSS JOIN app_user WHERE app_user.login = 'student.demo';

-- 10. Антиплагиат, documents, questions, Moodle -------------------------------------------------
INSERT INTO plagiarism_work (student_id, title, deadline, originality, status, filename, uploaded_at, attempts)
SELECT app_user.id, demo.title, demo.deadline::date, demo.originality, demo.status, demo.filename, demo.uploaded::timestamptz,
    CASE WHEN demo.filename IS NULL THEN 0 ELSE 1 END
FROM (VALUES
    ('student.demo', 'Эссе по экономической политике России', '2026-11-23', NULL, 'waiting', NULL, NULL),
    ('student.demo', 'Курсовая работа, черновик', '2026-12-01', NULL, 'waiting', NULL, NULL),
    ('student.demo', 'Реферат по экономической интеграции', '2026-11-10', 82, 'accepted', 'referat-integraciya.docx', '2026-11-09 20:15+03'),
    ('student.demo', 'Контрольная по финансам', '2026-11-17', 64, 'below', 'kontrolnaya-finansy.docx', '2026-11-16 22:40+03'),
    ('student.demo2', 'Эссе по мировому финансовому рынку', '2026-11-25', NULL, 'waiting', NULL, NULL),
    ('student.demo2', 'Реферат по экономической интеграции', '2026-11-10', 77, 'accepted', 'referat.docx', '2026-11-10 09:05+03')
) AS demo(login, title, deadline, originality, status, filename, uploaded)
JOIN app_user ON app_user.login = demo.login;

INSERT INTO issued_document (student_id, title, issued_on, kind)
SELECT app_user.id, demo.title, demo.day::date, demo.kind
FROM (VALUES
    ('student.demo', 'Справка об обучении', '2026-11-20', 'certificate'),
    ('student.demo', 'Выписка из зачётной книжки', '2026-10-02', 'extract'),
    ('student.demo', 'Приказ о зачислении, копия', '2026-09-01', 'order'),
    ('student.demo2', 'Справка о размере стипендии', '2026-11-12', 'certificate')
) AS demo(login, title, day, kind)
JOIN app_user ON app_user.login = demo.login;

INSERT INTO deanery_question (student_id, idempotency_key, topic, body, created_at, answer, answered_by, answered_at)
SELECT app_user.id, gen_random_uuid(), demo.topic, demo.body, demo.asked::timestamptz, demo.answer,
    CASE WHEN demo.answer IS NOT NULL THEN (SELECT id FROM app_user WHERE login = 'dean.demo') END,
    demo.answered::timestamptz
FROM (VALUES
    ('student.demo', 'documents', 'Можно получить справку об обучении на английском?', '2026-11-18 11:02+03',
     'Да. В заявке выберите язык «Английский», срок 3 рабочих дня.', '2026-11-18 14:20+03'),
    ('student.demo2', 'stipend', 'Когда придёт стипендия за ноябрь?', '2026-11-20 16:30+03', NULL, NULL)
) AS demo(login, topic, body, asked, answer, answered)
JOIN app_user ON app_user.login = demo.login;

INSERT INTO moodle_task (course_id, title, due_on)
SELECT cifry_course.id, demo.title, demo.due::date
FROM (VALUES
    ('Теория международной экономики', 'задание 4', '2026-11-25'),
    ('Экономическая политика России', 'эссе', '2026-11-23'),
    ('Мировой финансовый рынок', 'курсовая работа, черновик', '2026-12-01'),
    ('Финансы', 'кейс 3', '2026-12-08'),
    ('Налоги и налогообложение', 'тест 2', '2026-12-11'),
    ('Международная экономическая интеграция', 'презентация проекта', '2026-12-16')
) AS demo(course, title, due)
JOIN cifry_course ON cifry_course.name = demo.course;

-- 11. News of the faculty (Codex's announcement table) ------------------------------------------
INSERT INTO announcement (id, faculty_id, author_id, title, body, published_at)
SELECT gen_random_uuid(), staff.faculty_id, staff.id, demo.title, demo.body, demo.at::timestamptz
FROM (VALUES
    ('Запись на элективы весеннего семестра',
     'Запись открыта до 30 ноября. Выбрать нужно два курса из списка программы; изменить выбор можно до 5 декабря.',
     '2026-11-19 12:00+03'),
    ('24 ноября деканат принимает с 12:00',
     'Утром в деканате инвентаризация. Справки, готовые к 24 ноября, можно забрать после обеда или 25 ноября.',
     '2026-11-18 12:00+03'),
    ('Конкурс студенческих проектов',
     'Приём заявок до 5 декабря. Команды до четырёх человек; лучшие проекты покажут на весенней конференции.',
     '2026-11-15 12:00+03')
) AS demo(title, body, at)
JOIN app_user ON app_user.login = 'dean.demo' JOIN staff ON staff.id = app_user.id;

DROP VIEW cifry_course;
