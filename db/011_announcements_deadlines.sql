CREATE TABLE IF NOT EXISTS announcement (
    id uuid PRIMARY KEY,
    faculty_id uuid NOT NULL REFERENCES faculty,
    author_id uuid NOT NULL REFERENCES staff,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcement_faculty_date_idx
    ON announcement (faculty_id, published_at DESC);

CREATE TABLE IF NOT EXISTS deadline (
    id uuid PRIMARY KEY,
    course_id uuid NOT NULL REFERENCES course,
    title text NOT NULL,
    due_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS deadline_course_date_idx ON deadline (course_id, due_at);

INSERT INTO deadline (id, course_id, title, due_at)
SELECT demo.id::uuid, course.id, demo.title, demo.due_at::timestamptz
FROM (VALUES
 ('4cffd278-f9e8-4aea-902a-93b21f073001', 'Research Methods', 'Research proposal', '2026-11-20 18:00+03'),
 ('4cffd278-f9e8-4aea-902a-93b21f073002', 'Data Literacy', 'Data analysis assignment', '2026-11-22 18:00+03')
) AS demo(id, course_name, title, due_at)
JOIN course ON course.name = demo.course_name
ON CONFLICT (id) DO NOTHING;
