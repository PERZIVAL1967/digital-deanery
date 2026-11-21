CREATE TABLE IF NOT EXISTS grade_correction (
    student_id uuid NOT NULL,
    course_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    revision integer NOT NULL CHECK (revision > 0),
    score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
    reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
    actor_id uuid NOT NULL REFERENCES staff,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, course_id, attempt_no, revision),
    FOREIGN KEY (student_id, course_id, attempt_no) REFERENCES grade_attempt
);

ALTER TABLE grade_attempt ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES staff;
