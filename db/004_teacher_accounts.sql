CREATE TABLE IF NOT EXISTS teacher_account (
    user_id uuid PRIMARY KEY REFERENCES app_user ON DELETE CASCADE,
    teacher_id uuid NOT NULL UNIQUE REFERENCES teacher
);
