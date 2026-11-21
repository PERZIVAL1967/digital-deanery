BEGIN;

DO $test$
DECLARE
    faculty_key uuid;
    programme_key uuid;
    group_key uuid;
    student_key uuid;
    course_key uuid;
    other_course_key uuid;
    section_key uuid;
    room_key uuid;
    other_room_key uuid;
    teacher_key uuid;
    other_teacher_key uuid;
    class_slot tstzrange := '[2026-11-16 09:00+03,2026-11-16 10:30+03)';
BEGIN
    INSERT INTO faculty (name) VALUES ('Constraint test faculty') RETURNING id INTO faculty_key;
    INSERT INTO programme (faculty_id, name) VALUES (faculty_key, 'Test programme') RETURNING id INTO programme_key;
    INSERT INTO acad_group (programme_id, name) VALUES (programme_key, 'Test group') RETURNING id INTO group_key;
    INSERT INTO app_user (login, password_hash) VALUES ('constraint-test', 'disabled') RETURNING id INTO student_key;
    INSERT INTO student (id, group_id, name) VALUES (student_key, group_key, 'Test student');
    INSERT INTO course (faculty_id, name, credits) VALUES (faculty_key, 'Course A', 3) RETURNING id INTO course_key;
    INSERT INTO course (faculty_id, name, credits) VALUES (faculty_key, 'Course B', 3) RETURNING id INTO other_course_key;
    INSERT INTO section (course_id, label) VALUES (course_key, 'Seminar') RETURNING id INTO section_key;
    INSERT INTO enrolment VALUES (student_key, course_key);
    INSERT INTO enrolment VALUES (student_key, other_course_key);

    BEGIN
        INSERT INTO enrolment VALUES (student_key, course_key);
        RAISE EXCEPTION 'Duplicate enrolment accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO section_member VALUES (section_key, student_key, other_course_key);
        RAISE EXCEPTION 'Cross-course section membership accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    INSERT INTO section_member VALUES (section_key, student_key, course_key);

    INSERT INTO room (name) VALUES ('Test room') RETURNING id INTO room_key;
    INSERT INTO room (name) VALUES ('Second test room') RETURNING id INTO other_room_key;
    INSERT INTO teacher (name) VALUES ('Teacher A') RETURNING id INTO teacher_key;
    INSERT INTO teacher (name) VALUES ('Teacher B') RETURNING id INTO other_teacher_key;
    INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot)
        VALUES (section_key, room_key, teacher_key, class_slot);

    BEGIN
        INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot)
            VALUES (section_key, room_key, other_teacher_key, class_slot);
        RAISE EXCEPTION 'Double-booked room accepted';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot)
            VALUES (section_key, other_room_key, teacher_key, class_slot);
        RAISE EXCEPTION 'Double-booked teacher accepted';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;

    INSERT INTO class_occurrence (section_id, room_id, teacher_id, slot, status)
        VALUES (section_key, room_key, teacher_key, class_slot, 'cancelled');
END
$test$;

ROLLBACK;
