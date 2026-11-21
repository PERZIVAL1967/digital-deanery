CREATE TABLE IF NOT EXISTS grade_attempt (
    student_id uuid NOT NULL,
    course_id uuid NOT NULL,
    attempt_no integer NOT NULL CHECK (attempt_no > 0),
    score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
    assessed_on date NOT NULL,
    PRIMARY KEY (student_id, course_id, attempt_no),
    FOREIGN KEY (student_id, course_id) REFERENCES enrolment
);

INSERT INTO grade_attempt (student_id, course_id, attempt_no, score, assessed_on)
SELECT enrolment.student_id, enrolment.course_id, demo.attempt, demo.score, demo.day::date
FROM (VALUES
    ('student-a', 'Research Methods', 1, 48, '2026-11-05'),
    ('student-a', 'Research Methods', 2, 79, '2026-11-10'),
    ('student-a', 'Data Literacy', 1, 86, '2026-11-09'),
    ('student-b', 'Research Methods', 1, 71, '2026-11-05'),
    ('student-b', 'Data Literacy', 1, 53, '2026-11-09')
) AS demo(login, course_name, attempt, score, day)
JOIN app_user ON app_user.login = demo.login
JOIN enrolment ON enrolment.student_id = app_user.id
JOIN course ON course.id = enrolment.course_id AND course.name = demo.course_name
ON CONFLICT DO NOTHING;
