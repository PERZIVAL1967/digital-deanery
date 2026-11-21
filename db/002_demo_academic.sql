BEGIN;

DO $seed$
DECLARE
    humanities uuid;
    economics uuid;
    programme_a uuid;
    programme_b uuid;
    group_a uuid;
    group_b uuid;
    student_a uuid;
    student_b uuid;
    student_c uuid;
    seminar_course uuid;
    elective_course uuid;
    seminar_a uuid;
    seminar_b uuid;
    elective uuid;
    classroom uuid;
    lecturer uuid;
BEGIN
    INSERT INTO faculty (name) VALUES ('Humanities') RETURNING id INTO humanities;
    INSERT INTO faculty (name) VALUES ('Economics') RETURNING id INTO economics;
    INSERT INTO programme (faculty_id, name) VALUES (humanities, 'International Studies') RETURNING id INTO programme_a;
    INSERT INTO programme (faculty_id, name) VALUES (economics, 'Economics') RETURNING id INTO programme_b;
    INSERT INTO acad_group (programme_id, name) VALUES (programme_a, 'IS-101') RETURNING id INTO group_a;
    INSERT INTO acad_group (programme_id, name) VALUES (programme_b, 'EC-101') RETURNING id INTO group_b;

    INSERT INTO app_user (login, password_hash) VALUES ('student-a', '!disabled') RETURNING id INTO student_a;
    INSERT INTO app_user (login, password_hash) VALUES ('student-b', '!disabled') RETURNING id INTO student_b;
    INSERT INTO app_user (login, password_hash) VALUES ('student-c', '!disabled') RETURNING id INTO student_c;
    INSERT INTO student (id, group_id, name) VALUES
        (student_a, group_a, 'Anna Volkova'),
        (student_b, group_a, 'Boris Sokolov'),
        (student_c, group_b, 'Clara Orlova');
    WITH accounts AS (
        INSERT INTO app_user (login, password_hash)
        VALUES ('staff-a', '!disabled'), ('staff-b', '!disabled')
        RETURNING id, login
    )
    INSERT INTO staff (id, faculty_id, name)
    SELECT id,
        CASE login WHEN 'staff-a' THEN humanities ELSE economics END,
        CASE login WHEN 'staff-a' THEN 'Daria Belova' ELSE 'Elena Morozova' END
    FROM accounts;

    INSERT INTO course (faculty_id, name, credits) VALUES (humanities, 'Research Methods', 4) RETURNING id INTO seminar_course;
    INSERT INTO course (faculty_id, name, credits) VALUES (economics, 'Data Literacy', 3) RETURNING id INTO elective_course;
    INSERT INTO section (course_id, label) VALUES (seminar_course, 'Seminar A') RETURNING id INTO seminar_a;
    INSERT INTO section (course_id, label) VALUES (seminar_course, 'Seminar B') RETURNING id INTO seminar_b;
    INSERT INTO section (course_id, label) VALUES (elective_course, 'Shared elective') RETURNING id INTO elective;

    INSERT INTO enrolment VALUES
        (student_a, seminar_course), (student_b, seminar_course),
        (student_a, elective_course), (student_b, elective_course), (student_c, elective_course);
    INSERT INTO section_member VALUES
        (seminar_a, student_a, seminar_course), (seminar_b, student_b, seminar_course),
        (elective, student_a, elective_course), (elective, student_b, elective_course),
        (elective, student_c, elective_course);

    INSERT INTO room (name) VALUES ('301') RETURNING id INTO classroom;
    INSERT INTO teacher (name) VALUES ('Mikhail Lebedev') RETURNING id INTO lecturer;
    INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot, original_slot, original_room_id, status, version)
    VALUES
        (seminar_a, classroom, lecturer, '[2026-11-16 10:45+03,2026-11-16 12:15+03)',
         '[2026-11-16 09:00+03,2026-11-16 10:30+03)', classroom, 'moved', 1),
        (seminar_b, classroom, lecturer, '[2026-11-17 09:00+03,2026-11-17 10:30+03)',
         NULL, NULL, 'cancelled', 1),
        (elective, classroom, lecturer, '[2026-11-18 09:00+03,2026-11-18 10:30+03)',
         NULL, NULL, 'scheduled', 0);
END
$seed$;

COMMIT;
