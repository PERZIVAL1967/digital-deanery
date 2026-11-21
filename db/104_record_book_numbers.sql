-- Record-book numbers without the «ДЕМО» prefix (the UI should not carry demo labels).
-- Fictional numbers: 24001 for student.demo, 24002 for student.demo2, 24101.. for the seeded students.
UPDATE student_profile SET record_book = replace(record_book, 'ДЕМО-', '') WHERE record_book LIKE 'ДЕМО-%';
