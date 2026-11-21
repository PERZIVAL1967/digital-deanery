ALTER TABLE request
  DROP CONSTRAINT IF EXISTS request_kind_check,
  ADD CONSTRAINT request_kind_check CHECK (kind ~ '^[a-z][a-z0-9_]{0,63}$');
