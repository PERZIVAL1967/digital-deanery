ALTER TABLE course ADD COLUMN IF NOT EXISTS assessment_kind text NOT NULL
    DEFAULT 'credit' CHECK (assessment_kind IN ('credit','exam'));
ALTER TABLE class_occurrence ADD COLUMN IF NOT EXISTS is_exam boolean NOT NULL DEFAULT false;

UPDATE course SET assessment_kind = 'exam' WHERE name = 'Research Methods';

INSERT INTO class_occurrence (id, section_id, teacher_id, room_id, slot, is_exam)
SELECT demo.id::uuid, section.id, teacher.id, room.id, demo.slot::tstzrange, true
FROM (VALUES
 ('74d4ad9e-7462-48c6-9aaf-78896f422001','Seminar A','[2026-11-24 10:00+03,2026-11-24 11:30+03)'),
 ('74d4ad9e-7462-48c6-9aaf-78896f422002','Seminar B','[2026-11-25 10:00+03,2026-11-25 11:30+03)')
) AS demo(id, label, slot)
JOIN section ON section.label = demo.label
JOIN course ON course.id = section.course_id AND course.name = 'Research Methods'
JOIN teacher ON teacher.name = 'Mikhail Lebedev'
JOIN room ON room.name = '301'
ON CONFLICT DO NOTHING;
