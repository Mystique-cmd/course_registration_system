-- Course Registration System - Database Schema (PostgreSQL)
-- Creates the tables/constraints used by the PostgreSQL-backed backend.
--
-- Usage example (adjust DB name/user as needed):
--   psql "$DB_URL" -f ./db/schema.sql
--
-- Notes:
-- - This file is PostgreSQL-compatible (unlike the previous MySQL version).
-- - Tables/columns are designed to satisfy queries in server/index.js.

BEGIN;

-- ============================
-- Types (enums)
-- ============================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status_enum') THEN
    CREATE TYPE enrollment_status_enum AS ENUM ('Open', 'Waitlist');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_academic_status_enum') THEN
    CREATE TYPE student_academic_status_enum AS ENUM ('Good', 'Probation', 'Suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
    CREATE TYPE notification_type_enum AS ENUM ('course','payment','update','payment_reminder','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_status_enum') THEN
    CREATE TYPE billing_status_enum AS ENUM ('Pending','Paid','Credited');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_transaction_type_enum') THEN
    CREATE TYPE billing_transaction_type_enum AS ENUM ('Charge','Refund','Credit');
  END IF;
END$$;

-- ============================
-- Users
-- ============================
DROP TABLE IF EXISTS student_billing;
DROP TABLE IF EXISTS tuition_policies;
DROP TABLE IF EXISTS drop_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS waitlist_entries;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

CREATE TABLE students (
  id BIGSERIAL PRIMARY KEY,

  student_id VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,

  academic_status student_academic_status_enum NOT NULL DEFAULT 'Good',
  financial_hold BOOLEAN NOT NULL DEFAULT FALSE,
  minimum_courses INT NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL
);

CREATE UNIQUE INDEX uq_students_student_id ON students (student_id);
CREATE UNIQUE INDEX uq_students_email ON students (email);

-- ============================
-- Course catalog
-- ============================
CREATE TABLE courses (
  id BIGSERIAL PRIMARY KEY,

  course_code VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  instructor VARCHAR(200) NOT NULL,

  department VARCHAR(120) NOT NULL,
  semester VARCHAR(60) NOT NULL,

  enrollment_status enrollment_status_enum NOT NULL DEFAULT 'Open',
  seats_filled INT NOT NULL DEFAULT 0,
  seats_total INT NOT NULL DEFAULT 0,

  waitlist_count INT NOT NULL DEFAULT 0,
  waitlist_position_info VARCHAR(255) NULL,

  test_date_offset_days INT NOT NULL DEFAULT 14,

  drop_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  drop_deadline_days INT NOT NULL DEFAULT 14,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL
);

CREATE UNIQUE INDEX uq_courses_course_code ON courses (course_code);
CREATE INDEX idx_courses_department_semester ON courses (department, semester);
CREATE INDEX idx_courses_status ON courses (enrollment_status);

-- ============================
-- Registrations (student ↔ course)
-- ============================
CREATE TABLE registrations (
  id BIGSERIAL PRIMARY KEY,

  student_id_fk BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  course_id_fk BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  kcse_grade VARCHAR(16) NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Required for backend upsert:
-- ON CONFLICT (student_id_fk, course_id_fk) DO UPDATE ...
CREATE UNIQUE INDEX uq_registration_student_course ON registrations (student_id_fk, course_id_fk);
CREATE INDEX idx_reg_student ON registrations (student_id_fk);
CREATE INDEX idx_reg_course ON registrations (course_id_fk);

-- ============================
-- Waitlist entries
-- ============================
CREATE TABLE waitlist_entries (
  id BIGSERIAL PRIMARY KEY,

  student_id_fk BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  course_id_fk BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,

  position INT NOT NULL,
  probability DECIMAL(5,4) NOT NULL DEFAULT 0.0000,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_waitlist_student_course ON waitlist_entries (student_id_fk, course_id_fk);
CREATE INDEX idx_waitlist_course ON waitlist_entries (course_id_fk);

-- ============================
-- Notifications
-- ============================
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  student_id_fk BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,

  type notification_type_enum NOT NULL DEFAULT 'other',
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notif_student ON notifications (student_id_fk);
CREATE INDEX idx_notif_type ON notifications (type);

-- ============================
-- Drop logs (audit trail)
-- ============================
CREATE TABLE drop_logs (
  id BIGSERIAL PRIMARY KEY,
  student_id_fk BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  course_id_fk BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
  drop_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) NULL
);

CREATE INDEX idx_drop_student ON drop_logs (student_id_fk);
CREATE INDEX idx_drop_course ON drop_logs (course_id_fk);

-- ============================
-- Tuition and Billing
-- ============================
CREATE TABLE tuition_policies (
  id BIGSERIAL PRIMARY KEY,
  semester VARCHAR(60) NOT NULL,
  base_fee DECIMAL(10,2) NOT NULL,
  per_course_fee DECIMAL(10,2) NOT NULL,
  max_courses INT NOT NULL DEFAULT 5,
  max_tuition DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tuition_semester UNIQUE (semester)
);

CREATE TABLE student_billing (
  id BIGSERIAL PRIMARY KEY,
  student_id_fk BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  course_id_fk BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
  semester VARCHAR(60) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status billing_status_enum NOT NULL DEFAULT 'Pending',
  transaction_type billing_transaction_type_enum NOT NULL DEFAULT 'Charge',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_student ON student_billing (student_id_fk);
CREATE INDEX idx_billing_course ON student_billing (course_id_fk);

-- ============================
-- Seed course catalog
-- (safe to re-run; uses ON CONFLICT)
-- ============================
INSERT INTO courses
  (course_code, title, description, instructor, department, semester, enrollment_status,
   seats_filled, seats_total, waitlist_count, waitlist_position_info, test_date_offset_days,
   drop_allowed, drop_deadline_days)
VALUES
  (
    'CS 101', 'Intro to Programming',
    'Learn fundamental programming concepts including variables, loops, conditionals, and functions. Build your foundation in software development with practical coding exercises.',
    'Dr. A. Mwangi', 'Computer Science', 'Semester 1', 'Open',
    38, 50, 0, '', 4, TRUE, 14
  ),
  (
    'CS 201', 'Data Structures',
    'Explore essential data structures including arrays, linked lists, stacks, queues, and trees. Understand how to choose the right structure for optimal performance.',
    'Prof. J. Otieno', 'Computer Science', 'Semester 1', 'Waitlist',
    60, 60, 17, 'Positions 1–17 available', 10, TRUE, 21
  ),
  (
    'IT 120', 'IT Fundamentals',
    'Master foundational IT concepts covering computer systems, networking basics, databases, and security. Ideal for those starting their IT journey.',
    'Dr. N. Wanjiku', 'IT', 'Semester 1', 'Open',
    24, 40, 0, '', 8, TRUE, 14
  ),
  (
    'BIT 210', 'Business & Technology',
    'Examine the intersection of business strategy and technology implementation. Learn how enterprises leverage IT for competitive advantage.',
    'Prof. K. Wambui', 'Business IT', 'Semester 2', 'Open',
    29, 45, 0, '', 25, TRUE, 21
  ),
  (
    'CS 305', 'Advanced React Patterns',
    'Deep dive into advanced React patterns including hooks, context API, performance optimization, and state management. Build scalable web applications.',
    'Dr. S. Njoroge', 'Computer Science', 'Semester 2', 'Waitlist',
    55, 55, 9, 'Positions 1–9 available', 18, TRUE, 21
  ),
  (
    'ENG 110', 'Engineering Fundamentals',
    'Introduction to engineering principles, problem-solving methodologies, and technical design. Prepare for advanced engineering courses.',
    'Dr. P. Kimani', 'Engineering', 'Semester 2', 'Open',
    18, 30, 0, '', 8, TRUE, 14
  );

-- Update existing seeded rows deterministically (by course_code)
-- (keeps seats/counts/drop_deadlines in sync if you re-run)
UPDATE courses SET
  title = v.title,
  description = v.description,
  instructor = v.instructor,
  department = v.department,
  semester = v.semester,
  enrollment_status = v.enrollment_status,
  seats_filled = v.seats_filled,
  seats_total = v.seats_total,
  waitlist_count = v.waitlist_count,
  waitlist_position_info = v.waitlist_position_info,
  test_date_offset_days = v.test_date_offset_days,
  drop_allowed = v.drop_allowed,
  drop_deadline_days = v.drop_deadline_days
FROM (
  VALUES
    ('CS 101', 'Intro to Programming', 'Learn fundamental programming concepts including variables, loops, conditionals, and functions. Build your foundation in software development with practical coding exercises.', 'Dr. A. Mwangi', 'Computer Science', 'Semester 1', 'Open'::enrollment_status_enum, 38, 50, 0, ''::varchar, 4, TRUE, 14),
    ('CS 201', 'Data Structures', 'Explore essential data structures including arrays, linked lists, stacks, queues, and trees. Understand how to choose the right structure for optimal performance.', 'Prof. J. Otieno', 'Computer Science', 'Semester 1', 'Waitlist'::enrollment_status_enum, 60, 60, 17, 'Positions 1–17 available'::varchar, 10, TRUE, 21),
    ('IT 120', 'IT Fundamentals', 'Master foundational IT concepts covering computer systems, networking basics, databases, and security. Ideal for those starting their IT journey.', 'Dr. N. Wanjiku', 'IT', 'Semester 1', 'Open'::enrollment_status_enum, 24, 40, 0, ''::varchar, 8, TRUE, 14),
    ('BIT 210', 'Business & Technology', 'Examine the intersection of business strategy and technology implementation. Learn how enterprises leverage IT for competitive advantage.', 'Prof. K. Wambui', 'Business IT', 'Semester 2', 'Open'::enrollment_status_enum, 29, 45, 0, ''::varchar, 25, TRUE, 21),
    ('CS 305', 'Advanced React Patterns', 'Deep dive into advanced React patterns including hooks, context API, performance optimization, and state management. Build scalable web applications.', 'Dr. S. Njoroge', 'Computer Science', 'Semester 2', 'Waitlist'::enrollment_status_enum, 55, 55, 9, 'Positions 1–9 available'::varchar, 18, TRUE, 21),
    ('ENG 110', 'Engineering Fundamentals', 'Introduction to engineering principles, problem-solving methodologies, and technical design. Prepare for advanced engineering courses.', 'Dr. P. Kimani', 'Engineering', 'Semester 2', 'Open'::enrollment_status_enum, 18, 30, 0, ''::varchar, 8, TRUE, 14)
) AS v(
  course_code, title, description, instructor, department, semester, enrollment_status,
  seats_filled, seats_total, waitlist_count, waitlist_position_info,
  test_date_offset_days, drop_allowed, drop_deadline_days
)
WHERE courses.course_code = v.course_code;

-- ============================
-- Seed tuition policies
-- ============================
INSERT INTO tuition_policies (semester, base_fee, per_course_fee, max_courses, max_tuition)
VALUES
  ('Semester 1', 5000.00, 2500.00, 5, 17500.00),
  ('Semester 2', 5000.00, 2500.00, 5, 17500.00)
ON CONFLICT (semester) DO UPDATE SET
  base_fee = EXCLUDED.base_fee,
  per_course_fee = EXCLUDED.per_course_fee,
  max_courses = EXCLUDED.max_courses,
  max_tuition = EXCLUDED.max_tuition;

COMMIT;

