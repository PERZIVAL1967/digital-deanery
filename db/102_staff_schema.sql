-- Dean and teacher cabinets (architecture/STAFF-CABINETS.md §5). On top of Codex's 001-015 and our 100-101.
-- Every new row is reachable only through the session in SQL (lib/dal/staff.ts, lib/dal/teacher.ts).

-- поток: faculty -> programme -> stream -> academic group -> language group (section kind 'language')
CREATE TABLE IF NOT EXISTS stream (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id uuid NOT NULL REFERENCES programme,
    name text NOT NULL,
    course_year integer NOT NULL CHECK (course_year BETWEEN 1 AND 6),
    UNIQUE (programme_id, name)
);
ALTER TABLE acad_group ADD COLUMN IF NOT EXISTS stream_id uuid REFERENCES stream;

-- what a section is: a lecture of the поток, a group seminar, a language group of a group, an elective
ALTER TABLE section ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'seminar'
    CHECK (kind IN ('lecture', 'seminar', 'language', 'elective'));
ALTER TABLE section ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES acad_group;
ALTER TABLE section ADD COLUMN IF NOT EXISTS stream_id uuid REFERENCES stream;
ALTER TABLE section ADD COLUMN IF NOT EXISTS lang_no integer CHECK (lang_no BETWEEN 1 AND 9);

-- attendance: one row per student per class occurrence, marked by the teacher; the dean may excuse
CREATE TABLE IF NOT EXISTS attendance (
    occurrence_id uuid NOT NULL REFERENCES class_occurrence ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    excused boolean NOT NULL DEFAULT false,
    excuse_note text CHECK (excuse_note IS NULL OR length(excuse_note) BETWEEN 1 AND 300),
    marked_by uuid REFERENCES app_user,
    marked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (occurrence_id, student_id)
);
CREATE INDEX IF NOT EXISTS attendance_student_idx ON attendance (student_id);

-- every edit of a student's record by the deanery: who, when, field, old, new, reason
CREATE TABLE IF NOT EXISTS student_change_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES app_user,
    field text NOT NULL,
    old_value text,
    new_value text,
    reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_change_log_student_idx ON student_change_log (student_id, created_at DESC);

-- the teacher's journal: columns (assessments) of a section and the marks in its cells
CREATE TABLE IF NOT EXISTS assessment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL REFERENCES section,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
    held_on date NOT NULL,
    position integer NOT NULL DEFAULT 1,
    created_by uuid REFERENCES app_user,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessment_section_idx ON assessment (section_id, held_on);

-- attempt_no links a published mark to the grade_attempt the student sees (Codex's corrections apply to it)
CREATE TABLE IF NOT EXISTS assessment_mark (
    assessment_id uuid NOT NULL REFERENCES assessment ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
    attempt_no integer,
    recorded_by uuid REFERENCES app_user,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (assessment_id, student_id)
);

-- a teacher's correction of a published mark: waits for the dean; approved ones become Codex's grade_correction
CREATE TABLE IF NOT EXISTS grade_proposal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL REFERENCES assessment ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    old_score integer NOT NULL CHECK (old_score BETWEEN 0 AND 100),
    new_score integer NOT NULL CHECK (new_score BETWEEN 0 AND 100),
    reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    author_id uuid NOT NULL REFERENCES teacher_account (user_id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_by uuid REFERENCES staff,
    decided_at timestamptz,
    decision_note text CHECK (decision_note IS NULL OR length(decision_note) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS grade_proposal_one_pending ON grade_proposal (assessment_id, student_id) WHERE status = 'pending';

-- the grade log: direct dean edits (with a mandatory reason) and approved teacher corrections
CREATE TABLE IF NOT EXISTS grade_change (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES course,
    attempt_no integer NOT NULL,
    old_score integer NOT NULL,
    new_score integer NOT NULL,
    reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    source text NOT NULL CHECK (source IN ('dean', 'proposal')),
    actor_id uuid NOT NULL REFERENCES app_user,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- resits are assigned by the dean; the examiner enters the result
CREATE TABLE IF NOT EXISTS resit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES course,
    scheduled_at timestamptz NOT NULL,
    room text NOT NULL CHECK (length(room) BETWEEN 1 AND 60),
    examiner_id uuid NOT NULL REFERENCES teacher,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'passed', 'failed', 'absent')),
    result integer CHECK (result BETWEEN 0 AND 100),
    created_by uuid NOT NULL REFERENCES app_user,
    created_at timestamptz NOT NULL DEFAULT now(),
    result_by uuid REFERENCES app_user,
    result_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS resit_one_open ON resit (student_id, course_id) WHERE status = 'scheduled';

-- teacher assignments: a journal column with a deadline; with plagiarism it also opens an Антиплагиат work per student
CREATE TABLE IF NOT EXISTS assignment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL REFERENCES section,
    author_id uuid NOT NULL REFERENCES teacher_account (user_id),
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    due_on date NOT NULL,
    plagiarism boolean NOT NULL DEFAULT true,
    assessment_id uuid REFERENCES assessment ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE plagiarism_work ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES assignment ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS group_message (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL REFERENCES section,
    author_id uuid NOT NULL REFERENCES teacher_account (user_id),
    body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- a teacher asks the deanery for a room or a move; it lands in the dean's queue
CREATE TABLE IF NOT EXISTS teacher_request (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES teacher_account (user_id),
    occurrence_id uuid REFERENCES class_occurrence,
    kind text NOT NULL CHECK (kind IN ('room', 'move', 'other')),
    body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'rejected')),
    answer text CHECK (answer IS NULL OR length(answer) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_by uuid REFERENCES staff,
    resolved_at timestamptz
);

-- notifications for staff and teachers (Codex's notification is per student)
CREATE TABLE IF NOT EXISTS staff_notice (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
    kind text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz
);
CREATE INDEX IF NOT EXISTS staff_notice_user_idx ON staff_notice (user_id, created_at DESC);

-- one-tap certificates: the generated PDF of a request (spec: request.generated_pdf, kept in its own table)
CREATE TABLE IF NOT EXISTS generated_document (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL UNIQUE REFERENCES request,
    student_id uuid NOT NULL REFERENCES student ON DELETE CASCADE,
    number text NOT NULL UNIQUE,
    pdf bytea NOT NULL,
    created_by uuid NOT NULL REFERENCES staff,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS generated_document_no START 101;
ALTER TABLE issued_document ADD COLUMN IF NOT EXISTS generated_id uuid REFERENCES generated_document;

-- targeted news: no row = the whole faculty (Codex's announcement stays faculty-scoped)
CREATE TABLE IF NOT EXISTS announcement_target (
    announcement_id uuid PRIMARY KEY REFERENCES announcement,
    scope text NOT NULL CHECK (scope IN ('faculty', 'stream', 'group', 'section')),
    target_id uuid
);
