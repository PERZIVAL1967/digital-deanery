CREATE TABLE IF NOT EXISTS calendar_token (
    student_id uuid PRIMARY KEY REFERENCES student ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE
);
