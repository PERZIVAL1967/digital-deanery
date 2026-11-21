ALTER TABLE grade_attempt ADD COLUMN IF NOT EXISTS recorded_by_teacher uuid REFERENCES teacher_account(user_id);

CREATE TABLE IF NOT EXISTS grade_import (
    section_id uuid NOT NULL REFERENCES section,
    fingerprint text NOT NULL,
    imported_by uuid NOT NULL REFERENCES teacher_account(user_id),
    imported_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (section_id, fingerprint)
);
