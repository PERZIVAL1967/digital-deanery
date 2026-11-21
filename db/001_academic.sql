CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE faculty (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

CREATE TABLE programme (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id uuid NOT NULL REFERENCES faculty,
    name text NOT NULL,
    UNIQUE (faculty_id, name)
);

CREATE TABLE acad_group (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id uuid NOT NULL REFERENCES programme,
    name text NOT NULL,
    UNIQUE (programme_id, name)
);

CREATE TABLE app_user (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    login text NOT NULL UNIQUE,
    password_hash text NOT NULL
);

CREATE TABLE student (
    id uuid PRIMARY KEY REFERENCES app_user,
    group_id uuid NOT NULL REFERENCES acad_group,
    name text NOT NULL
);

CREATE TABLE staff (
    id uuid PRIMARY KEY REFERENCES app_user,
    faculty_id uuid NOT NULL REFERENCES faculty,
    name text NOT NULL
);

CREATE TABLE course (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id uuid NOT NULL REFERENCES faculty,
    name text NOT NULL,
    credits numeric NOT NULL CHECK (credits > 0)
);

CREATE TABLE enrolment (
    student_id uuid REFERENCES student,
    course_id uuid REFERENCES course,
    PRIMARY KEY (student_id, course_id)
);

CREATE TABLE section (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES course,
    label text NOT NULL,
    UNIQUE (id, course_id),
    UNIQUE (course_id, label)
);

CREATE TABLE section_member (
    section_id uuid,
    student_id uuid,
    course_id uuid NOT NULL,
    PRIMARY KEY (section_id, student_id),
    FOREIGN KEY (section_id, course_id) REFERENCES section (id, course_id),
    FOREIGN KEY (student_id, course_id) REFERENCES enrolment (student_id, course_id)
);

CREATE INDEX section_member_student_idx ON section_member (student_id);

CREATE TABLE room (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);

CREATE TABLE teacher (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);

CREATE TABLE class_occurrence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL REFERENCES section,
    room_id uuid NOT NULL REFERENCES room,
    teacher_id uuid NOT NULL REFERENCES teacher,
    slot tstzrange NOT NULL CHECK (
        NOT isempty(slot) AND NOT lower_inf(slot) AND NOT upper_inf(slot)
        AND lower_inc(slot) AND NOT upper_inc(slot)
        AND isfinite(lower(slot)) AND isfinite(upper(slot))
    ),
    original_slot tstzrange,
    original_room_id uuid REFERENCES room,
    status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'moved', 'cancelled')),
    version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
    CONSTRAINT class_room_overlap
        EXCLUDE USING gist (room_id WITH =, slot WITH &&) WHERE (status <> 'cancelled'),
    CONSTRAINT class_teacher_overlap
        EXCLUDE USING gist (teacher_id WITH =, slot WITH &&) WHERE (status <> 'cancelled')
);

CREATE INDEX class_occurrence_section_start_idx ON class_occurrence (section_id, lower(slot));
CREATE INDEX class_occurrence_slot_idx ON class_occurrence USING gist (slot);
