CREATE TABLE IF NOT EXISTS request (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES student,
 idempotency_key uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('certificate','leave')),
 status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','needs_info','ready','issued','rejected','withdrawn')),
 message text NOT NULL,
 version integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (student_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS request_event (
 request_id uuid NOT NULL REFERENCES request,
 version integer NOT NULL,
 actor_id uuid NOT NULL REFERENCES app_user,
 status text NOT NULL,
 message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (request_id,version)
);
CREATE TABLE IF NOT EXISTS change_event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL,
 entity_id uuid NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notification (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 change_event_id uuid NOT NULL REFERENCES change_event,
 student_id uuid NOT NULL REFERENCES student,
 seen_at timestamptz,
 read_at timestamptz,
 push_state text,
 UNIQUE (change_event_id,student_id)
);
