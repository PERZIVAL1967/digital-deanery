CREATE TABLE IF NOT EXISTS session (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry_idx ON session (expires_at);

CREATE TABLE IF NOT EXISTS login_attempt (
    login text PRIMARY KEY,
    failures integer NOT NULL,
    window_start timestamptz NOT NULL
);
