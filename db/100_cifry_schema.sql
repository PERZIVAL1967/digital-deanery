-- «Цифровой деканат» (Большие цифры): tables added on top of Codex's 001-015.
-- Every new table is scoped per student (student_id) or through enrolment, like Codex's tables.

ALTER TABLE grade_attempt ADD COLUMN IF NOT EXISTS note text
    CHECK (note IS NULL OR length(note) BETWEEN 1 AND 200);

-- Fields of the profile page (mock-up PFIELDS). Fictional values only.
CREATE TABLE IF NOT EXISTS student_profile (
    student_id uuid PRIMARY KEY REFERENCES student ON DELETE CASCADE,
    record_book text NOT NULL,
    study_level text NOT NULL,
    profile_name text NOT NULL,
    study_form text NOT NULL,
    admission_year integer NOT NULL,
    course_year integer NOT NULL CHECK (course_year BETWEEN 1 AND 6),
    study_status text NOT NULL,
    email text,
    gender text,
    birth_date date,
    phone text,
    address text
);

-- Антиплагиат: the upload is simulated. Only the file name is kept, never the file.
CREATE TABLE IF NOT EXISTS plagiarism_work (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    deadline date NOT NULL,
    threshold integer NOT NULL DEFAULT 75 CHECK (threshold BETWEEN 0 AND 100),
    originality integer CHECK (originality BETWEEN 0 AND 100),
    status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'accepted', 'below')),
    filename text CHECK (filename IS NULL OR length(filename) BETWEEN 1 AND 200),
    uploaded_at timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS plagiarism_work_student_idx ON plagiarism_work (student_id, deadline);

-- Documents the deanery has issued to a student.
CREATE TABLE IF NOT EXISTS issued_document (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    issued_on date NOT NULL,
    kind text NOT NULL CHECK (kind IN ('certificate', 'extract', 'order', 'other')),
    file_format text NOT NULL DEFAULT 'PDF'
);
CREATE INDEX IF NOT EXISTS issued_document_student_idx ON issued_document (student_id, issued_on DESC);

-- «Вопрос в деканат»: one row is one question and, later, the deanery's answer.
CREATE TABLE IF NOT EXISTS deanery_question (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    idempotency_key uuid NOT NULL,
    topic text NOT NULL CHECK (topic IN ('timetable', 'documents', 'stipend', 'other')),
    body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    answer text CHECK (answer IS NULL OR length(answer) BETWEEN 1 AND 2000),
    answered_by uuid REFERENCES staff,
    answered_at timestamptz,
    UNIQUE (student_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS deanery_question_student_idx ON deanery_question (student_id, created_at);

-- Moodle is external; only the next deadlines are mirrored (static fictional rows).
CREATE TABLE IF NOT EXISTS moodle_task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES course ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    due_on date NOT NULL
);
CREATE INDEX IF NOT EXISTS moodle_task_course_idx ON moodle_task (course_id, due_on);
